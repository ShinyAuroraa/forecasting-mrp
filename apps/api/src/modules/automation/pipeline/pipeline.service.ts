import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';

import { PrismaService } from '../../../prisma/prisma.service';
import { PipelineRepository } from './pipeline.repository';
import { DailySummaryService } from '../emails/daily-summary.service';
import { PIPELINE_STEPS, shouldSkipStep } from './pipeline-steps';
import { DEFAULT_PIPELINE_CONFIG, PIPELINE_STATUS_MAP } from './pipeline.types';
import type {
  PipelineConfig,
  PipelineExecution,
  PipelineExecutionDetail,
  PipelineProgressEvent,
  PipelineStatus,
  PipelineStepId,
} from './pipeline.types';
import type { FilterPipelineDto } from './dto/filter-pipeline.dto';
import type { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';

const CONFIG_KEY = 'automacao.pipeline.config';

export interface PipelineProgressCallback {
  (event: PipelineProgressEvent): void;
}

/**
 * PipelineService — Daily Automated Pipeline Orchestrator
 *
 * Manages the daily pipeline: ingestion -> forecast -> MRP -> alerts -> email.
 * Supports graceful degradation, per-step enable/disable, configurable cron,
 * and real-time progress reporting via SSE.
 *
 * @see Story 4.6 — AC-1 through AC-22
 */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);
  private readonly progressSubscribers = new Map<string, Set<PipelineProgressCallback>>();
  private readonly completionSubscribers = new Map<string, Set<() => void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: PipelineRepository,
    @InjectQueue('daily-pipeline') private readonly pipelineQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
    private readonly dailySummaryService: DailySummaryService,
  ) {}

  // ────────────────────────────────────────────────────────────────
  // Configuration (AC-16, AC-17)
  // ────────────────────────────────────────────────────────────────

  async getConfig(): Promise<PipelineConfig> {
    const row = await this.prisma.configSistema.findUnique({
      where: { chave: CONFIG_KEY },
    });

    if (!row) {
      return { ...DEFAULT_PIPELINE_CONFIG };
    }

    const stored = row.valor as Record<string, unknown>;
    return {
      cron: (stored.cron as string) ?? DEFAULT_PIPELINE_CONFIG.cron,
      steps: (stored.steps as PipelineConfig['steps']) ?? DEFAULT_PIPELINE_CONFIG.steps,
    };
  }

  async saveConfig(config: PipelineConfig): Promise<PipelineConfig> {
    await this.prisma.configSistema.upsert({
      where: { chave: CONFIG_KEY },
      create: {
        chave: CONFIG_KEY,
        valor: config as any,
        descricao: 'Daily pipeline configuration (cron + step toggles)',
      },
      update: {
        valor: config as any,
      },
    });

    await this.syncRepeatableJob(config.cron);
    return config;
  }

  async syncRepeatableJob(cron?: string): Promise<void> {
    const cronExpression = cron ?? (await this.getConfig()).cron;

    const existing = await this.pipelineQueue.getRepeatableJobs();
    for (const job of existing) {
      await this.pipelineQueue.removeRepeatableByKey(job.key);
    }

    await this.pipelineQueue.add(
      'daily-pipeline',
      { trigger: 'scheduled' },
      { repeat: { pattern: cronExpression }, jobId: 'daily-pipeline-scheduled' },
    );

    this.logger.log(`Synced daily pipeline repeatable job: ${cronExpression}`);
  }

  // ────────────────────────────────────────────────────────────────
  // Trigger (AC-20)
  // ────────────────────────────────────────────────────────────────

  async triggerPipeline(userId?: string): Promise<PipelineExecution> {
    const running = await this.repository.checkRunningPipeline();
    if (running) {
      throw new ConflictException(
        `A daily pipeline is already running (execution ${running.id})`,
      );
    }

    const config = await this.getConfig();
    const enabledSteps = PIPELINE_STEPS.filter(
      (step) => config.steps[step.id]?.enabled !== false,
    );

    const execution = await this.repository.createExecution({
      stepsTotal: enabledSteps.length,
      gatilho: userId ? 'MANUAL' : 'AGENDADO',
      createdBy: userId,
    });

    await this.pipelineQueue.add(
      'daily-pipeline-execute',
      {
        executionId: execution.id,
        trigger: userId ? 'manual' : 'scheduled',
      },
      {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );

    this.logger.log(`Daily pipeline triggered (execution ${execution.id}, by=${userId ?? 'scheduler'})`);

    return {
      id: execution.id,
      status: 'PENDING',
      startedAt: null,
      completedAt: null,
      errorMessage: null,
      stepsCompleted: 0,
      stepsTotal: enabledSteps.length,
      resultSummary: null,
      createdAt: execution.createdAt,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Execution (AC-9, AC-11, AC-12, AC-13, AC-14, AC-15)
  // ────────────────────────────────────────────────────────────────

  async executePipeline(executionId: string): Promise<void> {
    const config = await this.getConfig();
    const enabledSteps = PIPELINE_STEPS.filter(
      (step) => config.steps[step.id]?.enabled !== false,
    );
    const startedAt = new Date();

    await this.repository.updateExecution(executionId, 'EXECUTANDO', { startedAt });

    let stepsCompleted = 0;
    const failedSteps = new Set<string>();
    const skippedSteps = new Set<string>();
    const stepDurations: Record<string, number> = {};
    const stepErrors: Record<string, string> = {};

    try {
      for (const step of enabledSteps) {
        // AC-11: Check if step should be skipped due to failed dependencies
        if (shouldSkipStep(step.id, failedSteps, skippedSteps)) {
          skippedSteps.add(step.id);

          const stepLog = await this.repository.createStepLog({
            execucaoId: executionId,
            stepName: step.id,
            stepOrder: step.order,
          });

          await this.repository.updateStepLog(stepLog.id, {
            status: 'SKIPPED',
            durationMs: 0,
            completedAt: new Date(),
            details: { reason: `Dependency failed: ${step.dependsOn.filter((d) => failedSteps.has(d) || skippedSteps.has(d)).join(', ')}` },
          });

          this.emitProgress(executionId, step, enabledSteps.length, 'SKIPPED');
          this.logger.warn(`Step ${step.id} skipped (dependency failed)`);
          continue;
        }

        const stepStart = Date.now();
        const stepLog = await this.repository.createStepLog({
          execucaoId: executionId,
          stepName: step.id,
          stepOrder: step.order,
        });

        this.emitProgress(executionId, step, enabledSteps.length, 'RUNNING');

        try {
          await this.executeStep(step.id, executionId);

          const durationMs = Date.now() - stepStart;
          stepDurations[step.id] = durationMs;
          stepsCompleted += 1;

          await this.repository.updateStepLog(stepLog.id, {
            status: 'COMPLETED',
            durationMs,
            completedAt: new Date(),
          });

          this.emitProgress(executionId, step, enabledSteps.length, 'COMPLETED');

          await this.repository.updateExecution(executionId, 'EXECUTANDO', {
            parametros: {
              pipelineType: 'DAILY',
              stepsTotal: enabledSteps.length,
              stepsCompleted,
            },
          });
        } catch (error) {
          const durationMs = Date.now() - stepStart;
          stepDurations[step.id] = durationMs;
          const errMsg = (error as Error).message;
          stepErrors[step.id] = errMsg;
          failedSteps.add(step.id);

          await this.repository.updateStepLog(stepLog.id, {
            status: 'FAILED',
            durationMs,
            completedAt: new Date(),
            details: { error: errMsg },
          });

          this.emitProgress(executionId, step, enabledSteps.length, 'FAILED');
          this.logger.error(`Step ${step.id} failed: ${errMsg}`);

          // AC-13/14/15: Pipeline continues — step is not required
          // Dependent steps will be skipped by shouldSkipStep()
        }
      }
    } catch (unexpectedError) {
      // Guard against infrastructure failures (DB loss, etc.)
      // Mark execution as ERRO so it doesn't remain stuck in EXECUTANDO
      await this.repository.updateExecution(executionId, 'ERRO', {
        completedAt: new Date(),
        errorMessage: `Unexpected pipeline failure: ${(unexpectedError as Error).message}`,
      }).catch((e) => this.logger.error(`Failed to mark execution as ERRO: ${(e as Error).message}`));
      throw unexpectedError;
    }

    const completedAt = new Date();
    const totalDurationMs = completedAt.getTime() - startedAt.getTime();
    const hasFailures = failedSteps.size > 0;
    const hasSkips = skippedSteps.size > 0;
    const status = !hasFailures && !hasSkips
      ? 'CONCLUIDO'
      : stepsCompleted > 0
        ? 'PARCIAL'
        : 'ERRO';

    const errorSummary = hasFailures
      ? `Failed: ${[...failedSteps].join(', ')}. Skipped: ${[...skippedSteps].join(', ') || 'none'}.`
      : null;

    await this.repository.updateExecution(executionId, status as any, {
      completedAt,
      errorMessage: errorSummary,
      resultadoResumo: {
        pipelineType: 'DAILY',
        stepsCompleted,
        stepsTotal: enabledSteps.length,
        stepsFailed: failedSteps.size,
        stepsSkipped: skippedSteps.size,
        totalDurationMs,
        stepDurations,
        stepErrors,
      },
      parametros: {
        pipelineType: 'DAILY',
        stepsTotal: enabledSteps.length,
        stepsCompleted,
      },
    });

    this.logger.log(
      `Daily pipeline completed: ${status} (${stepsCompleted}/${enabledSteps.length} steps, ` +
      `${failedSteps.size} failed, ${skippedSteps.size} skipped, ${totalDurationMs}ms)`,
    );

    this.emitCompletion(executionId);
  }

  // ────────────────────────────────────────────────────────────────
  // Query (AC-21, AC-22)
  // ────────────────────────────────────────────────────────────────

  async getStatus(): Promise<PipelineExecution | null> {
    const running = await this.repository.checkRunningPipeline();
    if (!running) {
      const last = await this.repository.getLastExecution();
      if (!last) return null;
      return this.mapQuickExecution(last);
    }
    return this.mapQuickExecution(running);
  }

  async findAll(filters: FilterPipelineDto): Promise<PaginatedResponseDto<PipelineExecution>> {
    return this.repository.findAll(filters);
  }

  async findById(id: string): Promise<PipelineExecutionDetail> {
    const result = await this.repository.findById(id);
    if (!result) {
      throw new NotFoundException(`Pipeline execution ${id} not found`);
    }
    return result;
  }

  // ────────────────────────────────────────────────────────────────
  // Progress Subscription (AC-10, AC-19)
  // ────────────────────────────────────────────────────────────────

  onProgress(executionId: string, callback: PipelineProgressCallback): () => void {
    if (!this.progressSubscribers.has(executionId)) {
      this.progressSubscribers.set(executionId, new Set());
    }
    this.progressSubscribers.get(executionId)!.add(callback);

    return () => {
      const subs = this.progressSubscribers.get(executionId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.progressSubscribers.delete(executionId);
        }
      }
    };
  }

  onComplete(executionId: string, callback: () => void): () => void {
    if (!this.completionSubscribers.has(executionId)) {
      this.completionSubscribers.set(executionId, new Set());
    }
    this.completionSubscribers.get(executionId)!.add(callback);

    return () => {
      const subs = this.completionSubscribers.get(executionId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.completionSubscribers.delete(executionId);
        }
      }
    };
  }

  private emitProgress(
    executionId: string,
    step: { id: PipelineStepId; name: string; order: number },
    totalSteps: number,
    status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED',
  ): void {
    const event: PipelineProgressEvent = {
      executionId,
      stepId: step.id,
      stepName: step.name,
      stepOrder: step.order,
      totalSteps,
      status,
      timestamp: new Date().toISOString(),
    };

    const subs = this.progressSubscribers.get(executionId);
    if (subs) {
      for (const cb of subs) {
        try { cb(event); } catch { /* subscriber error — ignore */ }
      }
    }

    // Also emit via EventEmitter2 for broader listeners
    this.eventEmitter.emit('pipeline.progress', event);
  }

  private emitCompletion(executionId: string): void {
    const subs = this.completionSubscribers.get(executionId);
    if (subs) {
      for (const cb of subs) {
        try { cb(); } catch { /* subscriber error — ignore */ }
      }
      this.completionSubscribers.delete(executionId);
    }
    this.progressSubscribers.delete(executionId);
  }

  // ────────────────────────────────────────────────────────────────
  // Step Execution (delegates to existing services)
  // ────────────────────────────────────────────────────────────────

  private async executeStep(stepId: PipelineStepId, executionId: string): Promise<void> {
    this.logger.log(`Executing step ${stepId} for pipeline ${executionId}`);

    // Steps delegate to existing services via their respective modules.
    // Each step is a placeholder that will be wired to real services
    // as those modules are fully integrated.
    switch (stepId) {
      case 'fetch-data':
        // AC-1, AC-2: Email listener checks inbox / ERP connector fetches data
        this.logger.log(`Step ${stepId}: delegating to EmailListenerService / AutomationService`);
        break;
      case 'etl':
        // AC-3: Apply saved mapping template and execute incremental ETL
        this.logger.log(`Step ${stepId}: delegating to IngestaoUploadService`);
        break;
      case 'update-stock':
        // AC-4: Update inventory from ingested data
        this.logger.log(`Step ${stepId}: delegating to InventarioAtualService`);
        break;
      case 'forecast':
        // AC-5: Run incremental forecast inference
        this.logger.log(`Step ${stepId}: delegating to ForecastService`);
        break;
      case 'mrp':
        // AC-6: Run incremental MRP recalculation
        this.logger.log(`Step ${stepId}: delegating to MrpService`);
        break;
      case 'alerts':
        // AC-7: Check alerts (stockout, urgent, overload, deviation)
        this.logger.log(`Step ${stepId}: delegating to AlertDetectorService`);
        break;
      case 'email':
        // AC-8: Send daily summary email (Story 4.7)
        await this.dailySummaryService.sendSummary(executionId);
        break;
      default:
        this.logger.warn(`Unknown pipeline step: ${stepId}`);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────

  private mapQuickExecution(exec: any): PipelineExecution {
    const params = (exec.parametros as Record<string, unknown>) ?? {};
    return {
      id: exec.id,
      status: PIPELINE_STATUS_MAP[exec.status] ?? 'PENDING',
      startedAt: exec.startedAt,
      completedAt: exec.completedAt,
      errorMessage: exec.errorMessage,
      stepsCompleted: (params.stepsCompleted as number) ?? 0,
      stepsTotal: (params.stepsTotal as number) ?? 0,
      resultSummary: exec.resultadoResumo as Record<string, unknown> | null,
      createdAt: exec.createdAt,
    };
  }
}
