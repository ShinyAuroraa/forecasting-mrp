import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOverrideDto } from './dto/create-override.dto';
import { FilterOverridesDto } from './dto/filter-overrides.dto';
import { buildPaginatedResponse } from '../../common/dto/paginated-response.dto';

@Injectable()
export class ForecastOverrideService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * AC-3: Create a forecast override with audit fields.
   */
  async create(dto: CreateOverrideDto, userId?: string) {
    // Validate product exists
    const produto = await (this.prisma as any).produto.findUnique({
      where: { id: dto.produtoId },
      select: { id: true },
    });

    if (!produto) {
      throw new NotFoundException(
        `Product with id ${dto.produtoId} not found`,
      );
    }

    // AC-7: Validate override value
    if (dto.overrideP50 < 0) {
      throw new BadRequestException('Override value must be >= 0');
    }

    if (!dto.motivo || dto.motivo.trim().length === 0) {
      throw new BadRequestException('Motivo (reason) is required');
    }

    return (this.prisma as any).forecastOverride.create({
      data: {
        forecastResultadoId: dto.forecastResultadoId ?? null,
        produtoId: dto.produtoId,
        periodo: new Date(dto.periodo),
        originalP50: dto.originalP50 ?? null,
        overrideP50: dto.overrideP50,
        motivo: dto.motivo.trim(),
        categoriaOverride: dto.categoriaOverride,
        createdBy: userId ?? null,
      },
      include: {
        produto: { select: { id: true, codigo: true, descricao: true } },
      },
    });
  }

  /**
   * AC-4: List overrides for a product with pagination.
   */
  async findByProduct(produtoId: string, page = 1, limit = 50) {
    const where = { produtoId };

    const [data, total] = await Promise.all([
      (this.prisma as any).forecastOverride.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          produto: { select: { id: true, codigo: true, descricao: true } },
        },
      }),
      (this.prisma as any).forecastOverride.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * AC-5: List overrides within filters (period, category, product).
   */
  async findAll(filters: FilterOverridesDto) {
    const {
      produtoId,
      dateFrom,
      dateTo,
      categoriaOverride,
      page = 1,
      limit = 50,
    } = filters;

    const where: Record<string, unknown> = {};

    if (produtoId) where.produtoId = produtoId;
    if (categoriaOverride) where.categoriaOverride = categoriaOverride;

    if (dateFrom || dateTo) {
      where.periodo = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).forecastOverride.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          produto: { select: { id: true, codigo: true, descricao: true } },
        },
      }),
      (this.prisma as any).forecastOverride.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * AC-10: Get a single override by id.
   */
  async findById(id: string) {
    const override = await (this.prisma as any).forecastOverride.findUnique({
      where: { id },
      include: {
        produto: { select: { id: true, codigo: true, descricao: true } },
      },
    });

    if (!override) {
      throw new NotFoundException(`Override with id ${id} not found`);
    }

    return override;
  }

  /**
   * AC-6: Soft-revert an override by creating a new override with original value.
   */
  async revert(id: string, userId?: string) {
    const original = await (this.prisma as any).forecastOverride.findUnique({
      where: { id },
    });

    if (!original) {
      throw new NotFoundException(`Override with id ${id} not found`);
    }

    // AC-6: Cannot revert a revert — prevents infinite revert chains
    if (original.revertedFromId != null) {
      throw new BadRequestException(
        'Cannot revert a revert entry. Revert the original override instead.',
      );
    }

    // AC-6: originalP50 must be present to restore the original value
    if (original.originalP50 == null) {
      throw new BadRequestException(
        'Cannot revert: original forecast value (originalP50) is not available.',
      );
    }

    const revertValue = Number(original.originalP50);

    return (this.prisma as any).forecastOverride.create({
      data: {
        forecastResultadoId: original.forecastResultadoId,
        produtoId: original.produtoId,
        periodo: original.periodo,
        originalP50: original.overrideP50,
        overrideP50: revertValue,
        motivo: `REVERT: Reversão do override ${id}`,
        categoriaOverride: original.categoriaOverride,
        revertedFromId: id,
        createdBy: userId ?? null,
      },
      include: {
        produto: { select: { id: true, codigo: true, descricao: true } },
      },
    });
  }
}
