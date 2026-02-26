import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateTurnoDto } from './dto/create-turno.dto';
import { UpdateTurnoDto } from './dto/update-turno.dto';
import { FilterTurnoDto } from './dto/filter-turno.dto';
import { buildPaginatedResponse } from '../../../common/dto/paginated-response.dto';

@Injectable()
export class TurnosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateTurnoDto) {
    return this.prisma.turno.create({
      data,
      include: { centroTrabalho: true },
    });
  }

  async findAll(filters: FilterTurnoDto) {
    const {
      centroTrabalhoId,
      ativo,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const where: Record<string, unknown> = {};

    if (centroTrabalhoId) {
      where.centroTrabalhoId = centroTrabalhoId;
    }

    if (ativo !== undefined) {
      where.ativo = ativo;
    }

    const [data, total] = await Promise.all([
      this.prisma.turno.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { centroTrabalho: true },
      }),
      this.prisma.turno.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.turno.findUnique({
      where: { id },
      include: { centroTrabalho: true },
    });
  }

  async update(id: string, data: UpdateTurnoDto) {
    return this.prisma.turno.update({
      where: { id },
      data,
      include: { centroTrabalho: true },
    });
  }

  async softDelete(id: string) {
    return this.prisma.turno.update({
      where: { id },
      data: { ativo: false },
    });
  }
}
