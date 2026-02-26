import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { PrismaService } from '../../../prisma/prisma.service';
import { CycleRepository } from './cycle.repository';
import { CYCLE_DEFINITIONS, DEFAULT_SCHEDULES } from './cycle-definitions';
import {
  CYCLE_TYPE_TO_TIPO_EXECUCAO,
  CYCLE_PRIORITY,
} from './cycle.types';
import type {
  CycleType,
  CycleScheduleConfig,
  CycleScheduleInfo,
  CycleExecution,
  CycleExecutionDetail,
} from './cycle.types';
import type { FilterCyclesDto } from './dto/filter-cycles.dto';
import type { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';

const CONFIG_KEY = 'automacao.cycles.schedule';

/**
 * CycleService — Re-training Cycle Orchestrator
 *
 * Manages scheduled and manual cycle executions with
 * BullMQ repeatable jobs, DB-level concurrency guards, and
 * execution logging via ExecucaoPlanejamento.
 *
 * @see Story 4.5 — AC-1 through AC-13
 */
@Injectable()
export class CycleService {
  private readonly logger = new Logger(CycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: CycleRepository,
    @InjectQueue('cycles') private readonly cyclesQueue: Queue,
  ) {}

  // ────────────────────────────────────────────────────────────────
  // Schedule Config (AC-5, AC-6)
  // ────────────────────────────────────────────────────────────────

  async getScheduleConfig(): Promise<CycleScheduleConfig> {
    const row = await this.prisma.configSistema.findUnique({
      where: { chave: CONFIG_KEY },
    });

    if (!row) {
      return { ...DEFAULT_SCHEDULES };
    }

    const stored = row.valor as Record<string, string>;
    return {
      daily: stored.daily ?? DEFAULT_SCHEDULES.daily,
      weekly: stored.weekly ?? DEFAULT_SCHEDULES.weekly,
      monthly: stored.monthly ?? DEFAULT_SCHEDULES.monthly,
    };
  }

  async saveScheduleConfig(config: CycleScheduleConfig): Promise<CycleScheduleConfig> {
    await this.prisma.configSistema.upsert({
      where: { chave: CONFIG_KEY },
      create: {
        chave: CONFIG_KEY,
        valor: config as any,
        descricao: 'Re-training cycle cron schedules',
      },
      update: {
        valor: config as any,
      },
    });

    await this.syncRepeatableJobs(config);
    return config;
  }

  // ────────────────────────────────────────────────────────────────
  // Repeatable Jobs (AC-7)
  // ────────────────────────────────────────────────────────────────

  async syncRepeatableJobs(config?: CycleScheduleConfig): Promise<void> {
    const schedules = config ?? await this.getScheduleConfig();

    const existing = await this.cyclesQueue.getRepeatableJobs();
    for (const job of existing) {
      await this.cyclesQueue.removeRepeatableByKey(job.key);
    }

    const cycleTypes: Array<{ type: CycleType; cron: string }> = [
      { type: 'DAILY', cron: schedules.daily },
      { type: 'WEEKLY', cron: schedules.weekly },
      { type: 'MONTHLY', cron: schedules.monthly },
    ];

    for (const { type, cron } of cycleTypes) {
      await this.cyclesQueue.add(
        `cycle-${type.toLowerCase()}`,
        { cycleType: type },
        { repeat: { pattern: cron }, jobId: `cycle-${type.toLowerCase()}` },
      );
    }

    this.logger.log(`Synced repeatable jobs: daily=${schedules.daily}, weekly=${schedules.weekly}, monthly=${schedules.monthly}`);
  }

  // ────────────────────────────────────────────────────────────────
  // Trigger (AC-10)
  // ────────────────────────────────────────────────────────────────

  async triggerCycle(type: CycleType, userId?: string): Promise<CycleExecution> {
    const gatilho = type === 'MANUAL' ? 'MANUAL' : 'AGENDADO';
    const effectiveType = type === 'MANUAL' ? 'MONTHLY' : type;
    const definition = CYCLE_DEFINITIONS[effectiveType];

    // Conflict check (AC-12, AC-13)
    await this.checkConflicts(type);

    const execution = await this.repository.createExecution({
      type: effectiveType,
      gatilho: type === 'MANUAL' ? 'MANUAL' : 'AGENDADO',
      stepsTotal: definition.steps.length,
      createdBy: userId,
    });

    // Queue job for async processing
    await this.cyclesQueue.add(
      `cycle-execute-${type.toLowerCase()}`,
      {
        executionId: execution.id,
        cycleType: type,
      },
      {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );

    this.logger.log(`Cycle ${type} triggered (execution ${execution.id}, gatilho=${gatilho})`);

    // Return effectiveType (not the input type) to match what is persisted in the DB.
    // MANUAL triggers persist as CICLO_MENSAL, so the returned type is MONTHLY.
    // The gatilho column ('MANUAL' vs 'AGENDADO') distinguishes manual from scheduled.
    return {
      id: execution.id,
      type: effectiveType,
      status: 'PENDING',
      startedAt: null,
      completedAt: null,
      errorMessage: null,
      stepsCompleted: 0,
      stepsTotal: definition.steps.length,
      resultSummary: null,
      createdAt: execution.createdAt,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Execution (called by processor)
  // ────────────────────────────────────────────────────────────────

  async executeCycle(executionId: string, cycleType: CycleType): Promise<void> {
    const effectiveType = cycleType === 'MANUAL' ? 'MONTHLY' : cycleType;
    const definition = CYCLE_DEFINITIONS[effectiveType];
    const startedAt = new Date();

    await this.repository.updateExecution(executionId, 'EXECUTANDO', { startedAt });

    let stepsCompleted = 0;
    let hasFailure = false;
    const stepDurations: Record<string, number> = {};

    for (const step of definition.steps) {
      const stepStart = Date.now();
      const stepLog = await this.repository.createStepLog({
        execucaoId: executionId,
        stepName: step.name,
        stepOrder: step.order,
      });

      try {
        await this.executeStep(step.name, executionId);

        const durationMs = Date.now() - stepStart;
        stepDurations[step.name] = durationMs;
        stepsCompleted += 1;

        await this.repository.updateStepLog(stepLog.id, {
          status: 'COMPLETED',
          durationMs,
          completedAt: new Date(),
        });

        await this.repository.updateExecution(executionId, 'EXECUTANDO', {
          parametros: {
            cycleType,
            stepsTotal: definition.steps.length,
            stepsCompleted,
          },
        });
      } catch (error) {
        const durationMs = Date.now() - stepStart;
        stepDurations[step.name] = durationMs;
        hasFailure = true;

        await this.repository.updateStepLog(stepLog.id, {
          status: 'FAILED',
          durationMs,
          completedAt: new Date(),
          details: { error: (error as Error).message },
        });

        this.logger.error(`Step ${step.name} failed in cycle ${cycleType}: ${(error as Error).message}`);
        break;
      }
    }

    const completedAt = new Date();
    const totalDurationMs = completedAt.getTime() - startedAt.getTime();
    const status = hasFailure
      ? (stepsCompleted > 0 ? 'PARCIAL' : 'ERRO')
      : 'CONCLUIDO';

    await this.repository.updateExecution(executionId, status as any, {
      completedAt,
      errorMessage: hasFailure ? `Failed at step ${stepsCompleted + 1} of ${definition.steps.length}` : null,
      resultadoResumo: {
        cycleType,
        stepsCompleted,
        stepsTotal: definition.steps.length,
        totalDurationMs,
        stepDurations,
      },
      parametros: {
        cycleType,
        stepsTotal: definition.steps.length,
        stepsCompleted,
      },
    });

    this.logger.log(`Cycle ${cycleType} completed: ${status} (${stepsCompleted}/${definition.steps.length} steps, ${totalDurationMs}ms)`);
  }

  // ────────────────────────────────────────────────────────────────
  // Query (AC-9, AC-11)
  // ────────────────────────────────────────────────────────────────

  async findAll(filters: FilterCyclesDto): Promise<PaginatedResponseDto<CycleExecution>> {
    return this.repository.findAll(filters);
  }

  async findById(id: string): Promise<CycleExecutionDetail> {
    const result = await this.repository.findById(id);
    if (!result) {
      throw new NotFoundException(`Cycle execution ${id} not found`);
    }
    return result;
  }

  // ────────────────────────────────────────────────────────────────
  // Schedule Info (AC-14)
  // ────────────────────────────────────────────────────────────────

  async getScheduleInfo(): Promise<readonly CycleScheduleInfo[]> {
    const config = await this.getScheduleConfig();
    const types: Array<{ type: CycleType; cron: string }> = [
      { type: 'DAILY', cron: config.daily },
      { type: 'WEEKLY', cron: config.weekly },
      { type: 'MONTHLY', cron: config.monthly },
    ];

    const results: CycleScheduleInfo[] = [];
    for (const { type, cron } of types) {
      const definition = CYCLE_DEFINITIONS[type];
      const tipoExecucao = CYCLE_TYPE_TO_TIPO_EXECUCAO[type];
      const lastExec = await this.repository.getLastExecution(tipoExecucao);

      results.push({
        type,
        label: definition.label,
        cronExpression: cron,
        nextRunAt: this.getNextCronRun(cron),
        lastExecution: lastExec
          ? {
              id: lastExec.id,
              status: lastExec.status === 'CONCLUIDO'
                ? 'SUCCESS'
                : lastExec.status === 'ERRO'
                  ? 'FAILED'
                  : lastExec.status === 'PARCIAL'
                    ? 'PARTIAL'
                    : lastExec.status === 'EXECUTANDO'
                      ? 'RUNNING'
                      : 'PENDING',
              startedAt: lastExec.startedAt,
              completedAt: lastExec.completedAt,
              durationMs: lastExec.startedAt && lastExec.completedAt
                ? lastExec.completedAt.getTime() - lastExec.startedAt.getTime()
                : null,
            }
          : null,
      });
    }

    return results;
  }

  // ────────────────────────────────────────────────────────────────
  // Conflict Prevention (AC-12, AC-13)
  // ────────────────────────────────────────────────────────────────

  private async checkConflicts(type: CycleType): Promise<void> {
    const effectiveType = type === 'MANUAL' ? 'MONTHLY' : type;
    const tipoExecucao = CYCLE_TYPE_TO_TIPO_EXECUCAO[effectiveType];

    // AC-12: Only one cycle of each type at a time
    const sameTypeRunning = await this.repository.checkRunningCycle(tipoExecucao);
    if (sameTypeRunning) {
      throw new ConflictException(
        `A ${effectiveType} cycle is already running (execution ${sameTypeRunning.id})`,
      );
    }

    // AC-13: Higher-priority cycle blocks lower-priority
    const myPriority = CYCLE_PRIORITY[type];
    const runningAny = await this.repository.checkRunningCycle();
    if (runningAny) {
      const runningParams = runningAny.parametros as Record<string, unknown> | null;
      const runningType = (runningParams?.cycleType as CycleType) ?? 'MONTHLY';
      const runningPriority = CYCLE_PRIORITY[runningType] ?? 0;

      if (runningPriority > myPriority) {
        throw new ConflictException(
          `A higher-priority ${runningType} cycle is running (execution ${runningAny.id}). ${effectiveType} deferred.`,
        );
      }
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Step Execution (delegates to existing services)
  // ────────────────────────────────────────────────────────────────

  private async executeStep(stepName: string, executionId: string): Promise<void> {
    this.logger.log(`Executing step ${stepName} for execution ${executionId}`);

    // Steps delegate to existing services via their respective modules.
    // Each step is a placeholder that will be wired to real services
    // as those modules are integrated in future stories.
    switch (stepName) {
      case 'RUN_INFERENCE':
      case 'RETRAIN_MODELS':
      case 'COMPARE_FORECAST_ACTUAL':
      case 'UPDATE_MAPE':
      case 'GENERATE_ACCURACY_REPORT':
      case 'UPDATE_MODEL_METADATA':
        this.logger.log(`Step ${stepName}: delegating to forecast-engine`);
        break;
      case 'RECALCULATE_MRP':
        this.logger.log(`Step ${stepName}: delegating to MRP orchestrator`);
        break;
      case 'CHECK_ALERTS':
        this.logger.log(`Step ${stepName}: delegating to alert detector`);
        break;
      case 'UPDATE_CLASSIFICATION':
        this.logger.log(`Step ${stepName}: delegating to classificacao service`);
        break;
      case 'UPDATE_STOCK_PARAMS':
        this.logger.log(`Step ${stepName}: delegating to stock-params service`);
        break;
      default:
        this.logger.warn(`Unknown step: ${stepName}`);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Cron Helpers
  // ────────────────────────────────────────────────────────────────

  /**
   * Parse a 5-field cron expression and compute the next occurrence.
   * Handles daily (0 6 * * *), weekly (0 3 * * 1), and monthly (0 2 1 * *) patterns.
   */
  private getNextCronRun(cron: string): Date | null {
    try {
      const parts = cron.split(' ');
      if (parts.length !== 5) return null;

      const [minuteStr, hourStr, dayOfMonthStr, , dayOfWeekStr] = parts;
      const minute = Number(minuteStr);
      const hour = Number(hourStr);
      const now = new Date();

      // Weekly cron (e.g., 0 3 * * 1 — Monday at 03:00)
      if (dayOfMonthStr === '*' && dayOfWeekStr !== '*') {
        const targetDow = Number(dayOfWeekStr);
        const next = new Date(now);
        next.setHours(hour, minute, 0, 0);
        const currentDow = now.getDay();
        let daysAhead = targetDow - currentDow;
        if (daysAhead < 0 || (daysAhead === 0 && next <= now)) {
          daysAhead += 7;
        }
        next.setDate(next.getDate() + daysAhead);
        return next;
      }

      // Monthly cron (e.g., 0 2 1 * * — 1st of month at 02:00)
      if (dayOfMonthStr !== '*' && dayOfWeekStr === '*') {
        const targetDay = Number(dayOfMonthStr);
        const next = new Date(now.getFullYear(), now.getMonth(), targetDay, hour, minute, 0, 0);
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
        return next;
      }

      // Daily cron (e.g., 0 6 * * * — every day at 06:00)
      const next = new Date(now);
      next.setHours(hour, minute, 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    } catch {
      return null;
    }
  }
}
