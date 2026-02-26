import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { FilterProdutoDto } from './dto/filter-produto.dto';
import { buildPaginatedResponse } from '../../common/dto/paginated-response.dto';

@Injectable()
export class ProdutosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateProdutoDto) {
    return this.prisma.produto.create({ data });
  }

  async findAll(filters: FilterProdutoDto) {
    const { search, tipoProduto, categoriaId, ativo, page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { descricao: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tipoProduto) {
      where.tipoProduto = tipoProduto;
    }

    if (categoriaId) {
      where.categoriaId = categoriaId;
    }

    if (ativo !== undefined) {
      where.ativo = ativo;
    }

    const [data, total] = await Promise.all([
      this.prisma.produto.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { categoria: true, unidadeMedida: true },
      }),
      this.prisma.produto.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.produto.findUnique({
      where: { id },
      include: { categoria: true, unidadeMedida: true },
    });
  }

  async update(id: string, data: UpdateProdutoDto) {
    return this.prisma.produto.update({
      where: { id },
      data,
      include: { categoria: true, unidadeMedida: true },
    });
  }

  async softDelete(id: string) {
    return this.prisma.produto.update({
      where: { id },
      data: { ativo: false },
    });
  }
}
