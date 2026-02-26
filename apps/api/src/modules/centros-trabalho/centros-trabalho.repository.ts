import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCentroTrabalhoDto } from './dto/create-centro-trabalho.dto';
import { UpdateCentroTrabalhoDto } from './dto/update-centro-trabalho.dto';
import { FilterCentroTrabalhoDto } from './dto/filter-centro-trabalho.dto';
import { buildPaginatedResponse } from '../../common/dto/paginated-response.dto';

@Injectable()
export class CentrosTrabalhoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateCentroTrabalhoDto) {
    return this.prisma.centroTrabalho.create({ data });
  }

  async findAll(filters: FilterCentroTrabalhoDto) {
    const {
      search,
      tipo,
      ativo,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { nome: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tipo) {
      where.tipo = tipo;
    }

    if (ativo !== undefined) {
      where.ativo = ativo;
    }

    const [data, total] = await Promise.all([
      this.prisma.centroTrabalho.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.centroTrabalho.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.centroTrabalho.findUnique({
      where: { id },
      include: { turnos: { where: { ativo: true } } },
    });
  }

  async update(id: string, data: UpdateCentroTrabalhoDto) {
    return this.prisma.centroTrabalho.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string) {
    return this.prisma.centroTrabalho.update({
      where: { id },
      data: { ativo: false },
    });
  }
}
