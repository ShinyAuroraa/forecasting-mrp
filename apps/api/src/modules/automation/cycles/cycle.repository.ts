import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { buildPaginatedResponse } from '../../../common/dto/paginated-response.dto';
import { FilterCyclesDto } from './dto/filter-cycles.dto';
import {
  CYCLE_TYPE_TO_TIPO_EXECUCAO,
  TIPO_EXECUCAO_TO_CYCLE_TYPE,
  STATUS_MAP,
} from './cycle.types';
import type { CycleType, CycleExecution, CycleExecutionDetail, CycleStepLog } from './cycle.types';

const CYCLE_TIPOS = ['CICLO_DIARIO', 'CICLO_SEMANAL', 'CICLO_MENSAL'] as const;

const STATUS_REVERSE: Record<string, string> = {
  SUCCESS: 'CONCLUIDO',
  FAILED: 'ERRO',
  PARTIAL: 'PARCIAL',
  RUNNING: 'EXECUTANDO',
  PENDING: 'PENDENTE',
};

/**
 * CycleRepository — Data Access Layer for cycle executions.
 *
 * Reuses ExecucaoPlanejamento + ExecucaoStepLog tables with
 * CICLO_DIARIO / CICLO_SEMANAL / CICLO_MENSAL type values.
 *
 * @see Story 4.5 — AC-8 through AC-11
 */
@Injectable()
export class CycleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createExecution(params: {
    readonly type: CycleType;
    readonly gatilho: 'MANUAL' | 'AGENDADO';
    readonly parametros?: Record<string, unknown>;
    readonly createdBy?: string;
    readonly stepsTotal: number;
  }) {
    const tipo = CYCLE_TYPE_TO_TIPO_EXECUCAO[params.type];
    return this.prisma.execucaoPlanejamento.create({
      data: {
        tipo,
        status: 'PENDENTE',
        gatilho: params.gatilho,
        parametros: {
          cycleType: params.type,
          stepsTotal: params.stepsTotal,
          stepsCompleted: 0,
          ...(params.parametros ?? {}),
        },
        createdBy: params.createdBy ?? null,
      },
    });
  }

  async updateExecution(
    id: string,
    status: 'PENDENTE' | 'EXECUTANDO' | 'CONCLUIDO' | 'ERRO' | 'PARCIAL',
    extras?: {
      readonly startedAt?: Date;
      readonly completedAt?: Date;
      readonly errorMessage?: string;
      readonly resultadoResumo?: Record<string, unknown>;
      readonly parametros?: Record<string, unknown>;
    },
  ) {
    return this.prisma.execucaoPlanejamento.update({
      where: { id },
      data: {
        status,
        ...(extras?.startedAt !== undefined ? { startedAt: extras.startedAt } : {}),
        ...(extras?.completedAt !== undefined ? { completedAt: extras.completedAt } : {}),
        ...(extras?.errorMessage !== undefined ? { errorMessage: extras.errorMessage } : {}),
        ...(extras?.resultadoResumo !== undefined ? { resultadoResumo: extras.resultadoResumo } : {}),
        ...(extras?.parametros !== undefined ? { parametros: extras.parametros } : {}),
      },
    });
  }

  async createStepLog(params: {
    readonly execucaoId: string;
    readonly stepName: string;
    readonly stepOrder: number;
  }) {
    return this.prisma.execucaoStepLog.create({
      data: {
        execucaoId: params.execucaoId,
        stepName: params.stepName,
        stepOrder: params.stepOrder,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });
  }

  async updateStepLog(
    id: bigint,
    updates: {
      readonly status?: string;
      readonly recordsProcessed?: bigint;
      readonly durationMs?: number;
      readonly completedAt?: Date;
      readonly details?: Record<string, unknown>;
    },
  ) {
    return this.prisma.execucaoStepLog.update({
      where: { id },
      data: {
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.recordsProcessed !== undefined ? { recordsProcessed: updates.recordsProcessed } : {}),
        ...(updates.durationMs !== undefined ? { durationMs: updates.durationMs } : {}),
        ...(updates.completedAt !== undefined ? { completedAt: updates.completedAt } : {}),
        ...(updates.details !== undefined ? { details: updates.details } : {}),
      },
    });
  }

  async checkRunningCycle(tipo?: string) {
    // Check both PENDENTE and EXECUTANDO to guard against race conditions
    // where two requests pass the check before either starts executing.
    const statusFilter = { in: ['PENDENTE', 'EXECUTANDO'] as any };
    const where = tipo
      ? { tipo: tipo as any, status: statusFilter }
      : { tipo: { in: CYCLE_TIPOS as unknown as string[] } as any, status: statusFilter };

    return this.prisma.execucaoPlanejamento.findFirst({ where });
  }

  async findAll(filters: FilterCyclesDto) {
    const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

    const where: Record<string, unknown> = {
      tipo: { in: CYCLE_TIPOS },
    };

    if (filters.type) {
      where.tipo = CYCLE_TYPE_TO_TIPO_EXECUCAO[filters.type];
    }
    if (filters.status) {
      where.status = STATUS_REVERSE[filters.status];
    }
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.execucaoPlanejamento.findMany({
        where: where as any,
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: (page - 1) * limit,
        include: { stepLogs: { orderBy: { stepOrder: 'asc' } } },
      }),
      this.prisma.execucaoPlanejamento.count({ where: where as any }),
    ]);

    const mapped = data.map((exec) => this.mapExecution(exec));
    return buildPaginatedResponse(mapped, total, page, limit);
  }

  async findById(id: string): Promise<CycleExecutionDetail | null> {
    const exec = await this.prisma.execucaoPlanejamento.findUnique({
      where: { id },
      include: { stepLogs: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!exec || !CYCLE_TIPOS.includes(exec.tipo as any)) {
      return null;
    }

    return this.mapExecutionDetail(exec);
  }

  async getLastExecution(tipo: string) {
    return this.prisma.execucaoPlanejamento.findFirst({
      where: { tipo: tipo as any },
      orderBy: { createdAt: 'desc' },
    });
  }

  private mapExecution(exec: any): CycleExecution {
    const params = (exec.parametros as Record<string, unknown>) ?? {};
    return {
      id: exec.id,
      type: TIPO_EXECUCAO_TO_CYCLE_TYPE[exec.tipo] ?? 'MONTHLY',
      status: STATUS_MAP[exec.status] ?? 'PENDING',
      startedAt: exec.startedAt,
      completedAt: exec.completedAt,
      errorMessage: exec.errorMessage,
      stepsCompleted: (params.stepsCompleted as number) ?? 0,
      stepsTotal: (params.stepsTotal as number) ?? 0,
      resultSummary: exec.resultadoResumo as Record<string, unknown> | null,
      createdAt: exec.createdAt,
    };
  }

  private mapExecutionDetail(exec: any): CycleExecutionDetail {
    const base = this.mapExecution(exec);
    const steps: CycleStepLog[] = (exec.stepLogs ?? []).map((s: any) => ({
      id: String(s.id),
      stepName: s.stepName,
      stepOrder: s.stepOrder,
      status: s.status,
      recordsProcessed: s.recordsProcessed ? Number(s.recordsProcessed) : null,
      durationMs: s.durationMs,
      details: s.details as Record<string, unknown> | null,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
    }));
    return { ...base, steps };
  }
}
