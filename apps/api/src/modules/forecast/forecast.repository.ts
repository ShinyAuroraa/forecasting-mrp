import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { ExecuteForecastDto } from './dto/execute-forecast.dto';
import { FilterExecutionDto } from './dto/filter-execution.dto';
import { FilterMetricsDto } from './dto/filter-metrics.dto';
import { FilterModelsDto } from './dto/filter-models.dto';
import {
  ExecutionStatus,
  ForecastExecution,
  ExecutionWithSteps,
  ChampionInfo,
  PromotionHistoryEntry,
} from './forecast.interfaces';

@Injectable()
export class ForecastRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Prisma delegate accessors — bind to actual models after DB migration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get executions(): any {
    return (this.prisma as any).forecastExecution;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get metrics(): any {
    return (this.prisma as any).forecastMetric;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get models(): any {
    return (this.prisma as any).forecastModel;
  }

  async createExecution(dto: ExecuteForecastDto): Promise<ForecastExecution> {
    return this.executions.create({
      data: {
        jobType: dto.jobType,
        status: ExecutionStatus.QUEUED,
        produtoIds: dto.produtoIds ?? null,
        modelo: dto.modelo ?? null,
        horizonteSemanas: dto.horizonteSemanas ?? 13,
        holdoutWeeks: dto.holdoutWeeks ?? 13,
        forceRetrain: dto.forceRetrain ?? false,
        progress: 0,
      },
    });
  }

  async findAllExecutions(filters: FilterExecutionDto) {
    const {
      status,
      jobType,
      from,
      to,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (jobType) {
      where.jobType = jobType;
    }

    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.executions.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.executions.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findExecutionById(id: string): Promise<ExecutionWithSteps | null> {
    return this.executions.findUnique({
      where: { id },
      include: { steps: { orderBy: { step: 'asc' } } },
    });
  }

  async findMetrics(filters: FilterMetricsDto) {
    const {
      executionId,
      produtoId,
      classeAbc,
      modelName,
      isBaseline,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const where: Record<string, unknown> = {};

    if (executionId) where.executionId = executionId;
    if (produtoId) where.produtoId = produtoId;
    if (classeAbc) where.classeAbc = classeAbc;
    if (modelName) where.modelName = modelName;
    if (isBaseline !== undefined) where.isBaseline = isBaseline;

    const [data, total] = await Promise.all([
      this.metrics.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.metrics.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findModels(filters: FilterModelsDto) {
    const {
      modelName,
      isChampion,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const where: Record<string, unknown> = {};

    if (modelName) where.modelName = modelName;
    if (isChampion !== undefined) where.isChampion = isChampion;

    const [data, total] = await Promise.all([
      this.models.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.models.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findCurrentChampion(tipoModelo?: string): Promise<ChampionInfo | null> {
    const where: Record<string, unknown> = { isChampion: true };
    if (tipoModelo) where.tipoModelo = tipoModelo;

    return this.models.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tipoModelo: true,
        versao: true,
        isChampion: true,
        metricasTreino: true,
        treinadoEm: true,
        createdAt: true,
      },
    });
  }

  async findChampionHistory(
    tipoModelo?: string,
    limit = 10,
  ): Promise<PromotionHistoryEntry[]> {
    const where: Record<string, unknown> = {};
    if (tipoModelo) where.tipoModelo = tipoModelo;

    // Return recent models that have promotion_log in their metrics
    return this.models.findMany({
      where: {
        ...where,
        metricasTreino: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        tipoModelo: true,
        versao: true,
        isChampion: true,
        metricasTreino: true,
        treinadoEm: true,
        createdAt: true,
      },
    });
  }
}
