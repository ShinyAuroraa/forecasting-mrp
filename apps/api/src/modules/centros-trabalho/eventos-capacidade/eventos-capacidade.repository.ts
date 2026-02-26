import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateEventoCapacidadeDto } from './dto/create-evento-capacidade.dto';
import { UpdateEventoCapacidadeDto } from './dto/update-evento-capacidade.dto';
import { FilterEventoCapacidadeDto } from './dto/filter-evento-capacidade.dto';
import { buildPaginatedResponse } from '../../../common/dto/paginated-response.dto';

@Injectable()
export class EventosCapacidadeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateEventoCapacidadeDto) {
    return this.prisma.eventoCapacidade.create({
      data,
      include: { centroTrabalho: true },
    });
  }

  async findAll(filters: FilterEventoCapacidadeDto) {
    const { centroTrabalhoId, page = 1, limit = 50, sortBy = 'dataEvento', sortOrder = 'desc' } = filters;

    const where: Record<string, unknown> = {};
    if (centroTrabalhoId) where.centroTrabalhoId = centroTrabalhoId;

    const [data, total] = await Promise.all([
      this.prisma.eventoCapacidade.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { centroTrabalho: true },
      }),
      this.prisma.eventoCapacidade.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.eventoCapacidade.findUnique({
      where: { id },
      include: { centroTrabalho: true },
    });
  }

  async update(id: string, data: UpdateEventoCapacidadeDto) {
    return this.prisma.eventoCapacidade.update({
      where: { id },
      data,
      include: { centroTrabalho: true },
    });
  }
}
