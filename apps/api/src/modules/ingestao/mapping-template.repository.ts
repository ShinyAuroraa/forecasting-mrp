import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMappingTemplateDto } from './dto/create-mapping-template.dto';
import { UpdateMappingTemplateDto } from './dto/update-mapping-template.dto';
import { FilterMappingTemplateDto } from './dto/filter-mapping-template.dto';
import { buildPaginatedResponse } from '../../common/dto/paginated-response.dto';

const ALLOWED_SORT_FIELDS = new Set([
  'nome',
  'tipoFonte',
  'usageCount',
  'lastUsedAt',
  'updatedAt',
  'createdAt',
]);

@Injectable()
export class MappingTemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateMappingTemplateDto) {
    return this.prisma.mappingTemplate.create({
      data: {
        nome: data.nome,
        descricao: data.descricao,
        tipoFonte: data.tipoFonte as any,
        colunas: data.colunas as any,
        validationRules: data.validationRules as any,
      },
    });
  }

  async findAll(filters: FilterMappingTemplateDto) {
    const {
      search,
      tipoFonte,
      ativo,
      page = 1,
      limit = 50,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = filters;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { descricao: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tipoFonte) {
      where.tipoFonte = tipoFonte;
    }

    if (ativo !== undefined) {
      where.ativo = ativo;
    } else {
      where.ativo = true;
    }

    const [data, total] = await Promise.all([
      this.prisma.mappingTemplate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : 'updatedAt']: sortOrder },
      }),
      this.prisma.mappingTemplate.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.mappingTemplate.findFirst({
      where: { id, ativo: true },
    });
  }

  async update(id: string, data: UpdateMappingTemplateDto) {
    return this.prisma.mappingTemplate.update({
      where: { id },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.descricao !== undefined && { descricao: data.descricao }),
        ...(data.tipoFonte !== undefined && { tipoFonte: data.tipoFonte as any }),
        ...(data.colunas !== undefined && { colunas: data.colunas as any }),
        ...(data.validationRules !== undefined && {
          validationRules: data.validationRules as any,
        }),
      },
    });
  }

  async delete(id: string) {
    return this.prisma.mappingTemplate.update({
      where: { id },
      data: { ativo: false },
    });
  }

  async duplicate(id: string) {
    const original = await this.prisma.mappingTemplate.findFirst({
      where: { id, ativo: true },
    });
    if (!original) return null;

    return this.prisma.mappingTemplate.create({
      data: {
        nome: `${original.nome} (cópia)`,
        descricao: original.descricao,
        tipoFonte: original.tipoFonte,
        colunas: original.colunas as any,
        validationRules: original.validationRules as any,
      },
    });
  }

  async incrementUsage(id: string) {
    return this.prisma.mappingTemplate.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  async findByHeaders(headers: string[]) {
    const templates = await this.prisma.mappingTemplate.findMany({
      where: { ativo: true },
      orderBy: [{ usageCount: 'desc' }, { updatedAt: 'desc' }],
    });

    const normalizedHeaders = new Set(
      headers.map((h) => h.trim().toLowerCase()),
    );

    return templates
      .map((template) => {
        const colunas = template.colunas as unknown as Array<{
          sourceColumn: string;
        }>;
        const templateColumns = colunas.map((c) =>
          c.sourceColumn.toLowerCase(),
        );

        const matchCount = templateColumns.filter((col) =>
          normalizedHeaders.has(col),
        ).length;

        const matchScore =
          templateColumns.length > 0 ? matchCount / templateColumns.length : 0;

        return { template, matchScore, matchCount };
      })
      .filter((entry) => entry.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore || b.matchCount - a.matchCount);
  }
}
