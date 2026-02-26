import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFornecedorDto } from './dto/create-fornecedor.dto';
import { UpdateFornecedorDto } from './dto/update-fornecedor.dto';
import { FilterFornecedorDto } from './dto/filter-fornecedor.dto';
import { buildPaginatedResponse } from '../../common/dto/paginated-response.dto';

@Injectable()
export class FornecedoresRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateFornecedorDto) {
    return this.prisma.fornecedor.create({ data });
  }

  async findAll(filters: FilterFornecedorDto) {
    const {
      search,
      estado,
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
        { razaoSocial: { contains: search, mode: 'insensitive' } },
        { nomeFantasia: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (estado) {
      where.estado = estado;
    }

    if (ativo !== undefined) {
      where.ativo = ativo;
    }

    const [data, total] = await Promise.all([
      this.prisma.fornecedor.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.fornecedor.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.fornecedor.findUnique({
      where: { id },
      include: {
        produtoFornecedor: {
          include: { produto: true },
        },
      },
    });
  }

  async update(id: string, data: UpdateFornecedorDto) {
    return this.prisma.fornecedor.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string) {
    return this.prisma.fornecedor.update({
      where: { id },
      data: { ativo: false },
    });
  }
}
