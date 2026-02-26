import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { buildPaginatedResponse } from '../../../common/dto/paginated-response.dto';
import { TIPO_EXECUCAO_PIPELINE, PIPELINE_STATUS_MAP } from './pipeline.types';
import type { FilterPipelineDto } from './dto/filter-pipeline.dto';
import type {
  PipelineExecution,
  PipelineExecutionDetail,
  PipelineStepResult,
} from './pipeline.types';

const STATUS_REVERSE: Record<string, string> = {
  COMPLETED: 'CONCLUIDO',
  FAILED: 'ERRO',
  PARTIAL: 'PARCIAL',
  RUNNING: 'EXECUTANDO',
  PENDING: 'PENDENTE',
};

/**
 * PipelineRepository — Data Access Layer for daily pipeline executions.
 *
 * Reuses ExecucaoPlanejamento + ExecucaoStepLog tables with
 * PIPELINE_DIARIO type value.
 *
 *
 * @see Story 4.6 — AC-12, AC-22
 */
@Injectable()
export class PipelineRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createExecution(params: {
    readonly stepsTotal: number;
    readonly gatilho: 'MANUAL' | 'AGENDADO';
    readonly createdBy?: string;
  }) {
    return this.prisma.execucaoPlanejamento.create({
      data: {
        tipo: TIPO_EXECUCAO_PIPELINE,
        status: 'PENDENTE',
        gatilho: params.gatilho,
        parametros: {
          pipelineType: 'DAILY',
          stepsTotal: params.stepsTotal,
          stepsCompleted: 0,
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
      readonly errorMessage?: string | null;
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
      readonly durationMs?: number;
      readonly completedAt?: Date;
      readonly details?: Record<string, unknown>;
    },
  ) {
    return this.prisma.execucaoStepLog.update({
      where: { id },
      data: {
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.durationMs !== undefined ? { durationMs: updates.durationMs } : {}),
        ...(updates.completedAt !== undefined ? { completedAt: updates.completedAt } : {}),
        ...(updates.details !== undefined ? { details: updates.details } : {}),
      },
    });
  }

  async checkRunningPipeline() {
    return this.prisma.execucaoPlanejamento.findFirst({
      where: {
        tipo: TIPO_EXECUCAO_PIPELINE,
        status: { in: ['PENDENTE', 'EXECUTANDO'] },
      },
    });
  }

  async findAll(filters: FilterPipelineDto) {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

    const where: Record<string, unknown> = {
      tipo: TIPO_EXECUCAO_PIPELINE,
    };

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

  async findById(id: string): Promise<PipelineExecutionDetail | null> {
    const exec = await this.prisma.execucaoPlanejamento.findUnique({
      where: { id },
      include: { stepLogs: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!exec || exec.tipo !== TIPO_EXECUCAO_PIPELINE) {
      return null;
    }

    return this.mapExecutionDetail(exec);
  }

  async getLastExecution() {
    return this.prisma.execucaoPlanejamento.findFirst({
      where: { tipo: TIPO_EXECUCAO_PIPELINE },
      orderBy: { createdAt: 'desc' },
    });
  }

  private mapExecution(exec: any): PipelineExecution {
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

  private mapExecutionDetail(exec: any): PipelineExecutionDetail {
    const base = this.mapExecution(exec);
    const steps: PipelineStepResult[] = (exec.stepLogs ?? []).map((s: any) => ({
      stepId: s.stepName,
      status: s.status === 'COMPLETED' ? 'COMPLETED'
        : s.status === 'FAILED' ? 'FAILED'
        : s.status === 'SKIPPED' ? 'SKIPPED'
        : s.status === 'RUNNING' ? 'RUNNING'
        : 'PENDING',
      durationMs: s.durationMs,
      details: s.details as Record<string, unknown> | null,
      errorMessage: (s.details as Record<string, unknown>)?.error as string ?? null,
    }));
    return { ...base, steps };
  }
}
