import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  DashboardKpis,
  KpiCard,
  KpiVariation,
  RevenueChartData,
  RevenueChartPoint,
  DivergenceFlag,
  ParetoData,
  ParetoItem,
  StockCoverageData,
  StockCoverageItem,
  ActiveAlertsSummary,
  AlertSummaryCategory,
} from './dashboard.types';

/**
 * DashboardService — aggregates data for the Executive BI Dashboard.
 *
 * @see Story 4.8 — AC-1 to AC-19
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── KPI Cards (AC-1..4, AC-16) ────────────────────────────

  async getKpis(): Promise<DashboardKpis> {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const endPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [monthlyRevenue, forecastAccuracy, inventoryTurnover, fillRate] =
      await Promise.all([
        this.getMonthlyRevenueKpi(currentMonth, endCurrentMonth, previousMonth, endPreviousMonth),
        this.getForecastAccuracyKpi(),
        this.getInventoryTurnoverKpi(),
        this.getFillRateKpi(),
      ]);

    return {
      monthlyRevenue,
      forecastAccuracy,
      inventoryTurnover,
      fillRate,
      referenceDate: now.toISOString(),
    };
  }

  private async getMonthlyRevenueKpi(
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date,
  ): Promise<KpiCard> {
    const [currentAgg, previousAgg] = await Promise.all([
      this.prisma.serieTemporal.aggregate({
        _sum: { receita: true },
        where: {
          dataReferencia: { gte: currentStart, lte: currentEnd },
          granularidade: 'semanal',
        },
      }),
      this.prisma.serieTemporal.aggregate({
        _sum: { receita: true },
        where: {
          dataReferencia: { gte: previousStart, lte: previousEnd },
          granularidade: 'semanal',
        },
      }),
    ]);

    const current = Number(currentAgg._sum.receita ?? 0);
    const previous = Number(previousAgg._sum.receita ?? 0);

    return {
      label: 'Receita Mensal',
      value: current,
      unit: 'BRL',
      variation: this.buildVariation(current, previous),
    };
  }

  private async getForecastAccuracyKpi(): Promise<KpiCard> {
    // Weighted MAPE: SUM(mape * percentualReceita) / SUM(percentualReceita)
    // Use latest execucao metrics joined with SkuClassification
    const metrics = await this.prisma.forecastMetrica.findMany({
      where: { mape: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        mape: true,
        produtoId: true,
      },
    });

    if (metrics.length === 0) {
      return {
        label: 'Acurácia Forecast',
        value: 0,
        unit: '%',
        variation: { value: 0, percent: 0, direction: 'stable' },
      };
    }

    const productIds = [...new Set(metrics.map((m) => m.produtoId))];
    const classifications = await this.prisma.skuClassification.findMany({
      where: { produtoId: { in: productIds } },
      select: { produtoId: true, percentualReceita: true },
      take: 500,
    });

    const revenueMap = new Map<string, number>();
    for (const c of classifications) {
      revenueMap.set(c.produtoId, Number(c.percentualReceita ?? 0));
    }

    let weightedSum = 0;
    let weightTotal = 0;
    for (const m of metrics) {
      const weight = revenueMap.get(m.produtoId) ?? 0.001;
      weightedSum += Number(m.mape ?? 0) * weight;
      weightTotal += weight;
    }

    const weightedMape = weightTotal > 0 ? weightedSum / weightTotal : 0;
    const accuracy = Math.max(0, 100 - weightedMape);

    return {
      label: 'Acurácia Forecast',
      value: Math.round(accuracy * 100) / 100,
      unit: '%',
      variation: { value: 0, percent: 0, direction: 'stable' },
    };
  }

  private async getInventoryTurnoverKpi(): Promise<KpiCard> {
    // Turnover = annual revenue / average inventory value
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [revenueAgg, inventoryAgg] = await Promise.all([
      this.prisma.serieTemporal.aggregate({
        _sum: { receita: true },
        where: {
          dataReferencia: { gte: yearStart },
          granularidade: 'semanal',
        },
      }),
      this.prisma.$queryRaw<{ avg_value: Prisma.Decimal | null }[]>`
        SELECT AVG(
          CAST(quantidade_disponivel AS NUMERIC) * COALESCE(CAST(custo_medio_unitario AS NUMERIC), 0)
        ) AS avg_value
        FROM inventario_atual
      `,
    ]);

    const annualRevenue = Number(revenueAgg._sum.receita ?? 0);
    const avgInventory = Number(inventoryAgg[0]?.avg_value ?? 0);
    const turnover = avgInventory > 0 ? annualRevenue / avgInventory : 0;

    return {
      label: 'Giro de Estoque',
      value: Math.round(turnover * 100) / 100,
      unit: 'x',
      variation: { value: 0, percent: 0, direction: 'stable' },
    };
  }

  private async getFillRateKpi(): Promise<KpiCard> {
    // Fill Rate = delivered complete on-time / total planned orders
    const [totalOrders, completedOrders] = await Promise.all([
      this.prisma.ordemPlanejada.count({
        where: { status: { not: 'PLANEJADA' } },
      }),
      this.prisma.ordemPlanejada.count({
        where: { status: 'LIBERADA' },
      }),
    ]);

    const fillRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    return {
      label: 'Fill Rate (OTIF)',
      value: Math.round(fillRate * 100) / 100,
      unit: '%',
      variation: { value: 0, percent: 0, direction: 'stable' },
    };
  }

  private buildVariation(current: number, previous: number): KpiVariation {
    if (previous === 0) {
      return { value: current, percent: 0, direction: current > 0 ? 'up' : 'stable' };
    }

    const diff = current - previous;
    const percent = Math.round((diff / previous) * 10000) / 100;

    return {
      value: diff,
      percent,
      direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'stable',
    };
  }

  // ── Revenue Chart (AC-5..8, AC-17) ────────────────────────

  async getRevenueChart(): Promise<RevenueChartData> {
    const now = new Date();
    const startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const endForecast = new Date(now.getFullYear(), now.getMonth() + 3, 0);

    // Actual revenue — 12 months back
    const actuals = await this.prisma.serieTemporal.groupBy({
      by: ['dataReferencia'],
      _sum: { receita: true },
      where: {
        dataReferencia: { gte: startDate, lte: now },
        granularidade: 'mensal',
      },
      orderBy: { dataReferencia: 'asc' },
      take: 24,
    });

    // Forecast — next 3 months (both VOLUME and FATURAMENTO target types)
    const forecasts = await this.prisma.forecastResultado.findMany({
      where: {
        periodo: { gt: now, lte: endForecast },
      },
      orderBy: { periodo: 'asc' },
      take: 5000,
      select: {
        periodo: true,
        targetType: true,
        p10: true,
        p50: true,
        p90: true,
        faturamentoP50: true,
        faturamentoP10: true,
        faturamentoP90: true,
      },
    });

    // Group forecasts by month
    const forecastByMonth = new Map<string, {
      indirectSum: number;
      directSum: number;
      p10Sum: number;
      p90Sum: number;
      count: number;
    }>();

    for (const f of forecasts) {
      const monthKey = f.periodo.toISOString().slice(0, 7);
      const existing = forecastByMonth.get(monthKey) ?? {
        indirectSum: 0, directSum: 0, p10Sum: 0, p90Sum: 0, count: 0,
      };

      if (f.targetType === 'VOLUME') {
        // Indirect forecast: volume x price → use p50 as volume proxy
        existing.indirectSum += Number(f.p50 ?? 0);
        existing.p10Sum += Number(f.p10 ?? 0);
        existing.p90Sum += Number(f.p90 ?? 0);
      } else if (f.targetType === 'FATURAMENTO') {
        // Direct TFT forecast
        existing.directSum += Number(f.faturamentoP50 ?? 0);
        if (existing.p10Sum === 0) existing.p10Sum += Number(f.faturamentoP10 ?? 0);
        if (existing.p90Sum === 0) existing.p90Sum += Number(f.faturamentoP90 ?? 0);
      }
      existing.count++;
      forecastByMonth.set(monthKey, existing);
    }

    // Build points
    const points: RevenueChartPoint[] = [];
    const divergenceFlags: DivergenceFlag[] = [];

    // Actual months
    for (const a of actuals) {
      points.push({
        period: a.dataReferencia.toISOString().slice(0, 7),
        actual: Number(a._sum.receita ?? 0),
        forecastIndirect: null,
        forecastDirect: null,
        p10: null,
        p90: null,
      });
    }

    // Forecast months
    for (const [month, data] of forecastByMonth) {
      points.push({
        period: month,
        actual: null,
        forecastIndirect: data.indirectSum,
        forecastDirect: data.directSum || null,
        p10: data.p10Sum,
        p90: data.p90Sum,
      });

      // AC-8: divergence flag when indirect vs direct > 15%
      if (data.directSum > 0 && data.indirectSum > 0) {
        const divergence = Math.abs(data.indirectSum - data.directSum) /
          Math.max(data.indirectSum, data.directSum) * 100;
        if (divergence > 15) {
          divergenceFlags.push({
            period: month,
            divergencePercent: Math.round(divergence * 100) / 100,
            message: `Divergência de ${Math.round(divergence)}% entre forecast indireto e direto — possível mudança de mix/preço`,
          });
        }
      }
    }

    // Sort by period
    points.sort((a, b) => a.period.localeCompare(b.period));

    return { points, divergenceFlags };
  }

  // ── Pareto / ABC (AC-9..10, AC-18) ────────────────────────

  async getPareto(): Promise<ParetoData> {
    const classifications = await this.prisma.skuClassification.findMany({
      select: {
        classeAbc: true,
        percentualReceita: true,
        produto: { select: { id: true } },
      },
      take: 5000,
    });

    const classMap = new Map<string, { count: number; revenue: number }>();

    for (const c of classifications) {
      const cls = c.classeAbc;
      const existing = classMap.get(cls) ?? { count: 0, revenue: 0 };
      existing.count++;
      existing.revenue += Number(c.percentualReceita ?? 0);
      classMap.set(cls, existing);
    }

    const totalRevenue = [...classMap.values()].reduce((s, v) => s + v.revenue, 0);

    const items: ParetoItem[] = [];
    let cumulative = 0;

    // Sort: A, B, C
    for (const cls of ['A', 'B', 'C']) {
      const data = classMap.get(cls);
      if (!data) continue;

      const pct = totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0;
      cumulative += pct;

      items.push({
        classeAbc: cls,
        skuCount: data.count,
        totalRevenue: Math.round(data.revenue * 10000) / 100,
        revenuePercent: Math.round(pct * 100) / 100,
        cumulativePercent: Math.round(cumulative * 100) / 100,
      });
    }

    return { items, totalRevenue: Math.round(totalRevenue * 10000) / 100 };
  }

  // ── Stock Coverage Heatmap (AC-11..13, AC-19) ─────────────

  async getStockCoverage(): Promise<StockCoverageData> {
    // Top 50 SKUs by revenue (from classification)
    const topSkus = await this.prisma.skuClassification.findMany({
      orderBy: { percentualReceita: 'desc' },
      take: 50,
      select: {
        produtoId: true,
        classeAbc: true,
        produto: { select: { id: true, codigo: true, descricao: true } },
      },
    });

    const productIds = topSkus.map((s) => s.produtoId);

    // Get coverage days from ParametrosEstoque
    const params = await this.prisma.parametrosEstoque.findMany({
      where: { produtoId: { in: productIds } },
      orderBy: { calculatedAt: 'desc' },
      distinct: ['produtoId'],
      select: { produtoId: true, diasCoberturaAtual: true },
    });

    const coverageMap = new Map<string, number>();
    for (const p of params) {
      coverageMap.set(p.produtoId, Number(p.diasCoberturaAtual ?? 0));
    }

    const items: StockCoverageItem[] = topSkus.map((s) => {
      const days = coverageMap.get(s.produtoId) ?? 0;
      return {
        produtoId: s.produtoId,
        codigo: s.produto.codigo,
        descricao: s.produto.descricao,
        classeAbc: s.classeAbc,
        coverageDays: days,
        colorZone: this.getCoverageColor(days),
      };
    });

    return { items };
  }

  private getCoverageColor(days: number): 'red' | 'orange' | 'yellow' | 'green' {
    if (days < 7) return 'red';
    if (days < 14) return 'orange';
    if (days < 30) return 'yellow';
    return 'green';
  }

  // ── Active Alerts Summary ─────────────────────────────────

  async getActiveAlerts(): Promise<ActiveAlertsSummary> {
    const alerts = await this.prisma.notificacao.groupBy({
      by: ['tipo'],
      _count: { id: true },
      where: { acknowledgedAt: null },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    });

    const labelMap: Record<string, string> = {
      STOCKOUT: 'SKUs em Stockout',
      URGENT_PURCHASE: 'Compras Urgentes',
      CAPACITY_OVERLOAD: 'Centros Sobrecarregados',
      STORAGE_FULL: 'Armazéns Lotados',
      FORECAST_DEVIATION: 'Desvio de Forecast',
      PIPELINE_FAILURE: 'Falha de Pipeline',
    };

    const categories: AlertSummaryCategory[] = alerts.map((a) => ({
      type: a.tipo,
      label: labelMap[a.tipo] ?? a.tipo,
      count: a._count.id,
    }));

    const total = categories.reduce((s, c) => s + c.count, 0);

    return { categories, total };
  }
}
