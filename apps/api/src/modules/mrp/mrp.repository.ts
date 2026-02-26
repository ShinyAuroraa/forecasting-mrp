import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { FilterExecutionsDto } from './dto/filter-executions.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { FilterCapacityDto } from './dto/filter-capacity.dto';
import { FilterStockParamsDto } from './dto/filter-stock-params.dto';

/**
 * MrpRepository — Data Access Layer for MRP Orchestrator
 *
 * Encapsulates all Prisma operations for MRP executions, step logs,
 * planned orders, capacity records, and stock parameters.
 *
 * @see Story 3.10 — MRP Orchestrator & Execution API
 */
@Injectable()
export class MrpRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ────────────────────────────────────────────────────────────────
  // Execution CRUD
  // ────────────────────────────────────────────────────────────────

  /**
   * Create a new MRP planning execution record.
   *
   * @param params - Execution creation parameters
   * @returns The created ExecucaoPlanejamento record
   */
  async createExecution(params: {
    readonly tipo: 'MRP';
    readonly status: 'PENDENTE';
    readonly gatilho: 'MANUAL';
    readonly parametros?: Record<string, unknown>;
    readonly createdBy?: string;
  }) {
    return this.prisma.execucaoPlanejamento.create({
      data: {
        tipo: params.tipo,
        status: params.status,
        gatilho: params.gatilho,
        parametros: params.parametros ?? null,
        createdBy: params.createdBy ?? null,
      },
    });
  }

  /**
   * Update execution status and optional fields.
   *
   * @param id - Execution UUID
   * @param status - New status value
   * @param extras - Optional additional fields to update
   * @returns The updated ExecucaoPlanejamento record
   */
  async updateExecutionStatus(
    id: string,
    status: 'PENDENTE' | 'EXECUTANDO' | 'CONCLUIDO' | 'ERRO',
    extras?: {
      readonly startedAt?: Date;
      readonly completedAt?: Date;
      readonly errorMessage?: string;
      readonly resultadoResumo?: Record<string, unknown>;
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
      },
    });
  }

  /**
   * Check if there is an MRP execution currently running.
   * Used as a concurrency guard to prevent overlapping runs.
   *
   * @returns The running execution or null
   */
  async checkRunningExecution() {
    return this.prisma.execucaoPlanejamento.findFirst({
      where: {
        tipo: 'MRP',
        status: 'EXECUTANDO',
      },
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Step Log CRUD
  // ────────────────────────────────────────────────────────────────

  /**
   * Create a step log entry for the MRP execution pipeline.
   *
   * @param params - Step log creation parameters
   * @returns The created ExecucaoStepLog record
   */
  async createStepLog(params: {
    readonly execucaoId: string;
    readonly stepName: string;
    readonly stepOrder: number;
    readonly status: string;
    readonly startedAt: Date;
  }) {
    return this.prisma.execucaoStepLog.create({
      data: {
        execucaoId: params.execucaoId,
        stepName: params.stepName,
        stepOrder: params.stepOrder,
        status: params.status,
        startedAt: params.startedAt,
      },
    });
  }

  /**
   * Update a step log entry with completion or failure data.
   *
   * @param id - Step log BigInt ID
   * @param params - Fields to update
   * @returns The updated ExecucaoStepLog record
   */
  async updateStepLog(
    id: bigint,
    params: {
      readonly status?: string;
      readonly recordsProcessed?: number;
      readonly durationMs?: number;
      readonly completedAt?: Date;
      readonly details?: Record<string, unknown>;
    },
  ) {
    return this.prisma.execucaoStepLog.update({
      where: { id },
      data: {
        ...(params.status !== undefined ? { status: params.status } : {}),
        ...(params.recordsProcessed !== undefined ? { recordsProcessed: BigInt(params.recordsProcessed) } : {}),
        ...(params.durationMs !== undefined ? { durationMs: params.durationMs } : {}),
        ...(params.completedAt !== undefined ? { completedAt: params.completedAt } : {}),
        ...(params.details !== undefined ? { details: params.details } : {}),
      },
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Read Endpoints
  // ────────────────────────────────────────────────────────────────

  /**
   * Find MRP executions with pagination and optional status filter.
   *
   * @param filters - Pagination and filter parameters
   * @returns Paginated response with execution records
   */
  async findExecutions(filters: FilterExecutionsDto) {
    const {
      status,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const where: Record<string, unknown> = {
      tipo: 'MRP',
    };

    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.execucaoPlanejamento.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.execucaoPlanejamento.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * Find a single execution by ID, including its step logs.
   *
   * @param id - Execution UUID
   * @returns Execution with step logs or null
   */
  async findExecutionById(id: string) {
    return this.prisma.execucaoPlanejamento.findUnique({
      where: { id },
      include: {
        stepLogs: { orderBy: { stepOrder: 'asc' } },
      },
    });
  }

  /**
   * Find planned orders with pagination and optional filters.
   *
   * @param filters - Pagination and filter parameters
   * @returns Paginated response with order records
   */
  async findOrders(filters: FilterOrdersDto) {
    const {
      execucaoId,
      tipo,
      prioridade,
      produtoId,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const where: Record<string, unknown> = {};

    if (execucaoId) {
      where.execucaoId = execucaoId;
    }
    if (tipo) {
      where.tipo = tipo;
    }
    if (prioridade) {
      where.prioridade = prioridade;
    }
    if (produtoId) {
      where.produtoId = produtoId;
    }

    const [data, total] = await Promise.all([
      this.prisma.ordemPlanejada.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.ordemPlanejada.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * Find capacity load records with pagination and optional filters.
   *
   * @param filters - Pagination and filter parameters
   * @returns Paginated response with capacity records
   */
  async findCapacity(filters: FilterCapacityDto) {
    const {
      execucaoId,
      centroTrabalhoId,
      page = 1,
      limit = 50,
      sortBy = 'periodo',
      sortOrder = 'asc',
    } = filters;

    const where: Record<string, unknown> = {};

    if (execucaoId) {
      where.execucaoId = execucaoId;
    }
    if (centroTrabalhoId) {
      where.centroTrabalhoId = centroTrabalhoId;
    }

    const [data, total] = await Promise.all([
      this.prisma.cargaCapacidade.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.cargaCapacidade.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * Find stock parameter records with pagination and optional filters.
   *
   * @param filters - Pagination and filter parameters
   * @returns Paginated response with stock parameter records
   */
  async findStockParams(filters: FilterStockParamsDto) {
    const {
      execucaoId,
      produtoId,
      page = 1,
      limit = 50,
      sortBy = 'calculatedAt',
      sortOrder = 'desc',
    } = filters;

    const where: Record<string, unknown> = {};

    if (execucaoId) {
      where.execucaoId = execucaoId;
    }
    if (produtoId) {
      where.produtoId = produtoId;
    }

    const [data, total] = await Promise.all([
      this.prisma.parametrosEstoque.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.parametrosEstoque.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }
}
