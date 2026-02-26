import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateParadaProgramadaDto } from './dto/create-parada-programada.dto';
import { UpdateParadaProgramadaDto } from './dto/update-parada-programada.dto';
import { FilterParadaProgramadaDto } from './dto/filter-parada-programada.dto';
import { buildPaginatedResponse } from '../../../common/dto/paginated-response.dto';

@Injectable()
export class ParadasProgramadasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateParadaProgramadaDto) {
    return this.prisma.paradaProgramada.create({
      data,
      include: { centroTrabalho: true },
    });
  }

  async findAll(filters: FilterParadaProgramadaDto) {
    const { centroTrabalhoId, page = 1, limit = 50, sortBy = 'dataInicio', sortOrder = 'desc' } = filters;

    const where: Record<string, unknown> = {};
    if (centroTrabalhoId) where.centroTrabalhoId = centroTrabalhoId;

    const [data, total] = await Promise.all([
      this.prisma.paradaProgramada.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { centroTrabalho: true },
      }),
      this.prisma.paradaProgramada.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.paradaProgramada.findUnique({
      where: { id },
      include: { centroTrabalho: true },
    });
  }

  async update(id: string, data: UpdateParadaProgramadaDto) {
    return this.prisma.paradaProgramada.update({
      where: { id },
      data,
      include: { centroTrabalho: true },
    });
  }

  async delete(id: string) {
    return this.prisma.paradaProgramada.delete({ where: { id } });
  }
}
