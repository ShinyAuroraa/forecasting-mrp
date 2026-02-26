import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateRoteiroDto } from './dto/create-roteiro.dto';
import { UpdateRoteiroDto } from './dto/update-roteiro.dto';
import { FilterRoteiroDto } from './dto/filter-roteiro.dto';
import { buildPaginatedResponse } from '../../../common/dto/paginated-response.dto';

@Injectable()
export class RoteirosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateRoteiroDto) {
    return this.prisma.roteiroProducao.create({
      data,
      include: { produto: true, centroTrabalho: true },
    });
  }

  async findAll(filters: FilterRoteiroDto) {
    const {
      produtoId,
      centroTrabalhoId,
      ativo,
      page = 1,
      limit = 50,
      sortBy = 'sequencia',
      sortOrder = 'asc',
    } = filters;

    const where: Record<string, unknown> = {};

    if (produtoId) {
      where.produtoId = produtoId;
    }

    if (centroTrabalhoId) {
      where.centroTrabalhoId = centroTrabalhoId;
    }

    if (ativo !== undefined) {
      where.ativo = ativo;
    }

    const [data, total] = await Promise.all([
      this.prisma.roteiroProducao.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { produto: true, centroTrabalho: true },
      }),
      this.prisma.roteiroProducao.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.roteiroProducao.findUnique({
      where: { id },
      include: { produto: true, centroTrabalho: true },
    });
  }

  async findByProdutoId(produtoId: string) {
    return this.prisma.roteiroProducao.findMany({
      where: { produtoId, ativo: true },
      orderBy: { sequencia: 'asc' },
      include: { produto: true, centroTrabalho: true },
    });
  }

  async findByProdutoIdAndSequencia(
    produtoId: string,
    sequencia: number,
    excludeId?: string,
  ) {
    const where: Record<string, unknown> = {
      produtoId,
      sequencia,
      ativo: true,
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    return this.prisma.roteiroProducao.findFirst({ where });
  }

  async update(id: string, data: UpdateRoteiroDto) {
    return this.prisma.roteiroProducao.update({
      where: { id },
      data,
      include: { produto: true, centroTrabalho: true },
    });
  }

  async softDelete(id: string) {
    return this.prisma.roteiroProducao.update({
      where: { id },
      data: { ativo: false },
    });
  }
}
