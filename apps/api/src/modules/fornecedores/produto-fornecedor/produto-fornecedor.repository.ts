import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProdutoFornecedorDto } from './dto/create-produto-fornecedor.dto';
import { UpdateProdutoFornecedorDto } from './dto/update-produto-fornecedor.dto';
import { FilterProdutoFornecedorDto } from './dto/filter-produto-fornecedor.dto';
import { buildPaginatedResponse } from '../../../common/dto/paginated-response.dto';

@Injectable()
export class ProdutoFornecedorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateProdutoFornecedorDto) {
    return this.prisma.$transaction(async (tx) => {
      if (data.isPrincipal) {
        await tx.produtoFornecedor.updateMany({
          where: { produtoId: data.produtoId, isPrincipal: true },
          data: { isPrincipal: false },
        });
      }

      return tx.produtoFornecedor.create({
        data,
        include: { produto: true, fornecedor: true },
      });
    });
  }

  async findAll(filters: FilterProdutoFornecedorDto) {
    const {
      produtoId,
      fornecedorId,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const where: Record<string, unknown> = {};

    if (produtoId) {
      where.produtoId = produtoId;
    }

    if (fornecedorId) {
      where.fornecedorId = fornecedorId;
    }

    const [data, total] = await Promise.all([
      this.prisma.produtoFornecedor.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { produto: true, fornecedor: true },
      }),
      this.prisma.produtoFornecedor.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.produtoFornecedor.findUnique({
      where: { id },
      include: { produto: true, fornecedor: true },
    });
  }

  async update(id: string, data: UpdateProdutoFornecedorDto, produtoId: string) {
    return this.prisma.$transaction(async (tx) => {
      if (data.isPrincipal) {
        await tx.produtoFornecedor.updateMany({
          where: { produtoId, isPrincipal: true, id: { not: id } },
          data: { isPrincipal: false },
        });
      }

      return tx.produtoFornecedor.update({
        where: { id },
        data,
        include: { produto: true, fornecedor: true },
      });
    });
  }

  async delete(id: string) {
    return this.prisma.produtoFornecedor.delete({ where: { id } });
  }
}
