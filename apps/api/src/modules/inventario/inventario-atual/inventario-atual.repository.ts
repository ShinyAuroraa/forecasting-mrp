import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateInventarioAtualDto } from './dto/create-inventario-atual.dto';
import { UpdateInventarioAtualDto } from './dto/update-inventario-atual.dto';
import { FilterInventarioAtualDto } from './dto/filter-inventario-atual.dto';
import { buildPaginatedResponse } from '../../../common/dto/paginated-response.dto';

@Injectable()
export class InventarioAtualRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateInventarioAtualDto) {
    return this.prisma.inventarioAtual.create({
      data,
      include: { produto: true, deposito: true },
    });
  }

  async findAll(filters: FilterInventarioAtualDto) {
    const {
      produtoId,
      depositoId,
      search,
      fonteAtualizacao,
      page = 1,
      limit = 50,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = filters;

    const where: Record<string, unknown> = {};

    if (produtoId) {
      where.produtoId = produtoId;
    }

    if (depositoId) {
      where.depositoId = depositoId;
    }

    if (fonteAtualizacao) {
      where.fonteAtualizacao = fonteAtualizacao;
    }

    if (search) {
      where.produto = {
        OR: [
          { codigo: { contains: search, mode: 'insensitive' } },
          { descricao: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.inventarioAtual.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { produto: true, deposito: true },
      }),
      this.prisma.inventarioAtual.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.inventarioAtual.findUnique({
      where: { id },
      include: { produto: true, deposito: true },
    });
  }

  async update(id: string, data: UpdateInventarioAtualDto) {
    return this.prisma.inventarioAtual.update({
      where: { id },
      data,
      include: { produto: true, deposito: true },
    });
  }
}
