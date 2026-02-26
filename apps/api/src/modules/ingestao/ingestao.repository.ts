import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSerieTemporalDto } from './dto/create-serie-temporal.dto';
import { FilterSerieTemporalDto } from './dto/filter-serie-temporal.dto';
import { buildPaginatedResponse } from '../../common/dto/paginated-response.dto';

@Injectable()
export class IngestaoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateSerieTemporalDto) {
    return this.prisma.serieTemporal.create({
      data,
      include: { produto: true },
    });
  }

  async upsert(data: CreateSerieTemporalDto) {
    const { produtoId, dataReferencia, granularidade, ...rest } = data;
    return this.prisma.serieTemporal.upsert({
      where: {
        produtoId_dataReferencia_granularidade: {
          produtoId,
          dataReferencia: new Date(dataReferencia),
          granularidade: granularidade ?? 'semanal',
        },
      },
      update: { ...rest },
      create: { produtoId, dataReferencia, granularidade, ...rest },
    });
  }

  async findAll(filters: FilterSerieTemporalDto) {
    const {
      produtoId,
      granularidade,
      dateFrom,
      dateTo,
      page = 1,
      limit = 50,
      sortBy = 'dataReferencia',
      sortOrder = 'desc',
    } = filters;

    const where: Record<string, unknown> = {};

    if (produtoId) {
      where.produtoId = produtoId;
    }

    if (granularidade) {
      where.granularidade = granularidade;
    }

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.dataReferencia = dateFilter;
    }

    const [data, total] = await Promise.all([
      this.prisma.serieTemporal.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { produto: true },
      }),
      this.prisma.serieTemporal.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.serieTemporal.findUnique({
      where: { id },
      include: { produto: true },
    });
  }
}
