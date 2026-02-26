import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateDepositoDto } from './dto/create-deposito.dto';
import { UpdateDepositoDto } from './dto/update-deposito.dto';
import { FilterDepositoDto } from './dto/filter-deposito.dto';
import { buildPaginatedResponse } from '../../../common/dto/paginated-response.dto';

@Injectable()
export class DepositosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateDepositoDto) {
    return this.prisma.deposito.create({ data });
  }

  async findAll(filters: FilterDepositoDto) {
    const {
      search,
      tipo,
      ativo,
      page = 1,
      limit = 50,
      sortBy = 'codigo',
      sortOrder = 'asc',
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
      this.prisma.deposito.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.deposito.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.deposito.findUnique({
      where: { id },
      include: {
        inventarioAtual: {
          include: { produto: true },
        },
      },
    });
  }

  async update(id: string, data: UpdateDepositoDto) {
    return this.prisma.deposito.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string) {
    return this.prisma.deposito.update({
      where: { id },
      data: { ativo: false },
    });
  }
}
