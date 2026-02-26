import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecordLeadTimeDto } from './dto/record-lead-time.dto';
import { buildPaginatedResponse } from '../../../common/dto/paginated-response.dto';

export interface LeadTimeStats {
  count: number;
  mean: number;
  stddev: number;
  min: number;
  max: number;
  sigmaLtDias: number;
}

@Injectable()
export class LeadTimeTrackingService {
  static readonly MIN_OBSERVATIONS_FOR_SIGMA = 5;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * AC-4: Record a new lead time observation.
   */
  async record(dto: RecordLeadTimeDto) {
    // Validate ProdutoFornecedor exists
    const pf = await this.prisma.produtoFornecedor.findUnique({
      where: { id: dto.produtoFornecedorId },
      select: { id: true },
    });

    if (!pf) {
      throw new NotFoundException(
        `ProdutoFornecedor with id ${dto.produtoFornecedorId} not found`,
      );
    }

    return this.prisma.historicoLeadTime.create({
      data: {
        produtoFornecedorId: dto.produtoFornecedorId,
        leadTimeRealDias: dto.leadTimeRealDias,
        leadTimePlanejadoDias: dto.leadTimePlanejadoDias ?? null,
        dataEntrega: new Date(dto.dataEntrega),
        pedidoRef: dto.pedidoRef ?? null,
        observacao: dto.observacao ?? null,
      },
    });
  }

  /**
   * AC-5: Get paginated history for a supplier-product.
   */
  async getHistory(produtoFornecedorId: string, page = 1, limit = 50) {
    const where = { produtoFornecedorId };

    const [data, total] = await Promise.all([
      this.prisma.historicoLeadTime.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { dataEntrega: 'desc' },
      }),
      this.prisma.historicoLeadTime.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * AC-6: Compute statistics from historical lead time data.
   */
  async calculateStats(produtoFornecedorId: string): Promise<LeadTimeStats> {
    const records = await this.prisma.historicoLeadTime.findMany({
      where: { produtoFornecedorId },
      select: { leadTimeRealDias: true },
    });

    if (records.length === 0) {
      return { count: 0, mean: 0, stddev: 0, min: 0, max: 0, sigmaLtDias: 0 };
    }

    const values = records.map((r) => r.leadTimeRealDias);
    const count = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / count;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Sample standard deviation (Bessel's correction, n-1 denominator)
    const variance =
      count > 1
        ? values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (count - 1)
        : 0;
    const stddev = Math.sqrt(variance);

    return {
      count,
      mean: Math.round(mean * 100) / 100,
      stddev: Math.round(stddev * 100) / 100,
      min,
      max,
      sigmaLtDias: Math.round(stddev * 100) / 100,
    };
  }

  /**
   * AC-7: Get sigma_LT for a product — finds the principal supplier's
   * historical data and computes stddev. Returns null if insufficient data.
   */
  async getSigmaLt(
    produtoId: string,
  ): Promise<{ sigmaLtDias: number; source: 'HISTORICAL' | 'ESTIMATE' } | null> {
    // Find the principal supplier link
    const supplierLink = await this.prisma.produtoFornecedor.findFirst({
      where: { produtoId },
      orderBy: [{ isPrincipal: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    });

    if (!supplierLink) {
      return null;
    }

    const stats = await this.calculateStats(supplierLink.id);

    if (stats.count >= LeadTimeTrackingService.MIN_OBSERVATIONS_FOR_SIGMA) {
      return { sigmaLtDias: stats.sigmaLtDias, source: 'HISTORICAL' };
    }

    return null; // Not enough data — caller should fall back to estimate
  }
}
