import { Injectable, NotFoundException } from '@nestjs/common';
import { ClassificacaoRepository } from './classificacao.repository';
import { FilterClassificacaoDto } from './dto/filter-classificacao.dto';
import { UpdateClassificacaoDto } from './dto/update-classificacao.dto';

interface SkuAggregation {
  produtoId: string;
  totalReceita: number;
  weeklyVolumes: number[];
}

export interface RecalculationResult {
  totalClassified: number;
  distribution: {
    abc: Record<string, number>;
    xyz: Record<string, number>;
    demanda: Record<string, number>;
  };
  calculadoEm: string;
}

const MODEL_SUGGESTION: Record<string, string> = {
  'A_REGULAR': 'TFT',
  'A_INTERMITENTE': 'CROSTON',
  'A_ERRATICO': 'TFT',
  'A_LUMPY': 'TSB',
  'B_REGULAR': 'TFT',
  'B_INTERMITENTE': 'CROSTON',
  'B_ERRATICO': 'ETS',
  'B_LUMPY': 'TSB',
  'C_REGULAR': 'ETS',
  'C_INTERMITENTE': 'CROSTON',
  'C_ERRATICO': 'ETS',
  'C_LUMPY': 'TSB',
};

@Injectable()
export class ClassificacaoService {
  constructor(private readonly repository: ClassificacaoRepository) {}

  async findAll(filters: FilterClassificacaoDto) {
    return this.repository.findAll(filters);
  }

  async findByProdutoId(produtoId: string) {
    const result = await this.repository.findByProdutoId(produtoId);
    if (!result) {
      throw new NotFoundException(
        `Classificacao para produto ${produtoId} nao encontrada`,
      );
    }
    return result;
  }

  async update(produtoId: string, dto: UpdateClassificacaoDto) {
    await this.findByProdutoId(produtoId);
    return this.repository.update(produtoId, dto);
  }

  async recalculate(): Promise<RecalculationResult> {
    const timeSeriesData = await this.repository.getTimeSeriesData();
    const activeProductIds = await this.repository.getActiveProductIds();

    const aggregations = this.aggregateByProduct(
      timeSeriesData,
      activeProductIds,
    );

    const abcClassifications = this.calculateAbc(aggregations);
    const calculadoEm = new Date();

    const distribution = {
      abc: { A: 0, B: 0, C: 0 } as Record<string, number>,
      xyz: { X: 0, Y: 0, Z: 0 } as Record<string, number>,
      demanda: {
        REGULAR: 0,
        INTERMITENTE: 0,
        ERRATICO: 0,
        LUMPY: 0,
      } as Record<string, number>,
    };

    for (const agg of aggregations) {
      const classeAbc = abcClassifications.get(agg.produtoId)!;
      const classeXyz = this.calculateXyz(agg.weeklyVolumes);
      const padraoDemanda = this.calculateDemandPattern(agg.weeklyVolumes);
      const modelKey = `${classeAbc}_${padraoDemanda}`;
      const modeloForecastSugerido = MODEL_SUGGESTION[modelKey] ?? 'ETS';

      const totalReceita = aggregations.reduce((s, a) => s + a.totalReceita, 0);
      const percentualReceita =
        totalReceita > 0 ? agg.totalReceita / totalReceita : 0;
      const cvDemanda = this.calculateCv(agg.weeklyVolumes);

      await this.repository.upsert(agg.produtoId, {
        classeAbc,
        classeXyz,
        padraoDemanda,
        modeloForecastSugerido,
        percentualReceita,
        cvDemanda,
        calculadoEm,
      });

      distribution.abc[classeAbc] = (distribution.abc[classeAbc] ?? 0) + 1;
      distribution.xyz[classeXyz] = (distribution.xyz[classeXyz] ?? 0) + 1;
      distribution.demanda[padraoDemanda] =
        (distribution.demanda[padraoDemanda] ?? 0) + 1;
    }

    return {
      totalClassified: aggregations.length,
      distribution,
      calculadoEm: calculadoEm.toISOString(),
    };
  }

  aggregateByProduct(
    data: Array<{
      produtoId: string;
      dataReferencia: Date;
      volume: unknown;
      receita: unknown;
    }>,
    activeProductIds: string[],
  ): SkuAggregation[] {
    const activeSet = new Set(activeProductIds);
    const map = new Map<
      string,
      { totalReceita: number; weekMap: Map<string, number> }
    >();

    for (const row of data) {
      if (!activeSet.has(row.produtoId)) continue;

      if (!map.has(row.produtoId)) {
        map.set(row.produtoId, { totalReceita: 0, weekMap: new Map() });
      }

      const entry = map.get(row.produtoId)!;
      entry.totalReceita += Number(row.receita ?? 0);

      const date = new Date(row.dataReferencia);
      const weekKey = this.getWeekKey(date);
      const existing = entry.weekMap.get(weekKey) ?? 0;
      entry.weekMap.set(weekKey, existing + Number(row.volume ?? 0));
    }

    const results: SkuAggregation[] = [];
    for (const [produtoId, entry] of map.entries()) {
      results.push({
        produtoId,
        totalReceita: entry.totalReceita,
        weeklyVolumes: Array.from(entry.weekMap.values()),
      });
    }

    return results;
  }

  calculateAbc(aggregations: SkuAggregation[]): Map<string, string> {
    const sorted = [...aggregations].sort(
      (a, b) => b.totalReceita - a.totalReceita,
    );
    const totalRevenue = sorted.reduce((s, a) => s + a.totalReceita, 0);

    const result = new Map<string, string>();

    if (totalRevenue === 0) {
      for (const agg of sorted) {
        result.set(agg.produtoId, 'C');
      }
      return result;
    }

    let cumulative = 0;
    for (const agg of sorted) {
      cumulative += agg.totalReceita;
      const cumulativePct = cumulative / totalRevenue;

      if (cumulativePct <= 0.8) {
        result.set(agg.produtoId, 'A');
      } else if (cumulativePct <= 0.95) {
        result.set(agg.produtoId, 'B');
      } else {
        result.set(agg.produtoId, 'C');
      }
    }

    return result;
  }

  calculateXyz(weeklyVolumes: number[]): string {
    if (weeklyVolumes.length === 0) return 'Z';
    const cv = this.calculateCv(weeklyVolumes);
    if (cv <= 0.5) return 'X';
    if (cv <= 1.0) return 'Y';
    return 'Z';
  }

  calculateDemandPattern(weeklyVolumes: number[]): string {
    if (weeklyVolumes.length === 0) return 'LUMPY';
    const zeroCount = weeklyVolumes.filter((v) => v === 0).length;
    const zeroPct = zeroCount / weeklyVolumes.length;

    if (zeroPct <= 0.05) return 'REGULAR';
    if (zeroPct <= 0.25) return 'INTERMITENTE';
    if (zeroPct <= 0.5) return 'ERRATICO';
    return 'LUMPY';
  }

  calculateCv(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    if (mean === 0) return 0;
    const variance =
      values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    return stdDev / mean;
  }

  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const diff = date.getTime() - startOfYear.getTime();
    const week = Math.ceil((diff / (7 * 24 * 60 * 60 * 1000)) + 1);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }
}
