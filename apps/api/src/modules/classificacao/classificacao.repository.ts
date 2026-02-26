import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FilterClassificacaoDto } from './dto/filter-classificacao.dto';
import { UpdateClassificacaoDto } from './dto/update-classificacao.dto';
import { buildPaginatedResponse } from '../../common/dto/paginated-response.dto';

@Injectable()
export class ClassificacaoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: FilterClassificacaoDto) {
    const {
      classeAbc,
      classeXyz,
      padraoDemanda,
      search,
      page = 1,
      limit = 50,
      sortBy = 'calculadoEm',
      sortOrder = 'desc',
    } = filters;

    const where: Record<string, unknown> = {};

    if (classeAbc) where.classeAbc = classeAbc;
    if (classeXyz) where.classeXyz = classeXyz;
    if (padraoDemanda) where.padraoDemanda = padraoDemanda;

    if (search) {
      where.produto = {
        OR: [
          { codigo: { contains: search, mode: 'insensitive' } },
          { descricao: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.skuClassification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { produto: true },
      }),
      this.prisma.skuClassification.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findByProdutoId(produtoId: string) {
    return this.prisma.skuClassification.findUnique({
      where: { produtoId },
      include: { produto: true },
    });
  }

  async update(produtoId: string, data: UpdateClassificacaoDto) {
    return this.prisma.skuClassification.update({
      where: { produtoId },
      data,
      include: { produto: true },
    });
  }

  async upsert(
    produtoId: string,
    data: Record<string, unknown>,
  ) {
    return this.prisma.skuClassification.upsert({
      where: { produtoId },
      update: data,
      create: { produtoId, ...data } as any,
    });
  }

  async getTimeSeriesData() {
    return this.prisma.serieTemporal.findMany({
      select: {
        produtoId: true,
        dataReferencia: true,
        volume: true,
        receita: true,
      },
      orderBy: { dataReferencia: 'asc' },
    });
  }

  async getActiveProductIds(): Promise<string[]> {
    const products = await this.prisma.produto.findMany({
      where: { ativo: true },
      select: { id: true },
    });
    return products.map((p) => p.id);
  }
}
