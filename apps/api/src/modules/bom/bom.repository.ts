import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';
import { FilterBomDto } from './dto/filter-bom.dto';
import { buildPaginatedResponse } from '../../common/dto/paginated-response.dto';

@Injectable()
export class BomRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateBomDto) {
    return this.prisma.bom.create({
      data,
      include: { produtoPai: true, produtoFilho: true, unidadeMedida: true },
    });
  }

  async findAll(filters: FilterBomDto) {
    const {
      produtoPaiId,
      produtoFilhoId,
      ativo,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const where: Record<string, unknown> = {};

    if (produtoPaiId) {
      where.produtoPaiId = produtoPaiId;
    }

    if (produtoFilhoId) {
      where.produtoFilhoId = produtoFilhoId;
    }

    if (ativo !== undefined) {
      where.ativo = ativo;
    }

    const [data, total] = await Promise.all([
      this.prisma.bom.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { produtoPai: true, produtoFilho: true },
      }),
      this.prisma.bom.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.bom.findUnique({
      where: { id },
      include: { produtoPai: true, produtoFilho: true, unidadeMedida: true },
    });
  }

  async findByProdutoPaiId(produtoPaiId: string) {
    return this.prisma.bom.findMany({
      where: { produtoPaiId, ativo: true },
      include: {
        produtoFilho: true,
        unidadeMedida: true,
      },
    });
  }

  async update(id: string, data: UpdateBomDto) {
    return this.prisma.bom.update({
      where: { id },
      data,
      include: { produtoPai: true, produtoFilho: true, unidadeMedida: true },
    });
  }

  async softDelete(id: string) {
    return this.prisma.bom.update({
      where: { id },
      data: { ativo: false },
    });
  }
}
