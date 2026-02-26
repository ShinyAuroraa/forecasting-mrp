import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SCENARIO_KEY_PREFIX,
  type ScenarioData,
  type ScenarioImpact,
  type ImpactMetrics,
  type ImpactDelta,
  type ForecastComparisonPoint,
} from './scenario.types';
import { CreateScenarioDto } from './dto/create-scenario.dto';

/**
 * ScenarioService — What-If Scenario creation and impact analysis.
 *
 * Scenarios are stored as JSON in ConfigSistema (key: cenario.whatif.{id}).
 * Impact analysis runs a lightweight read-only simulation without persisting.
 *
 * @see Story 4.9 — AC-1 to AC-13
 */
@Injectable()
export class ScenarioService {
  private readonly logger = new Logger(ScenarioService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── CRUD (AC-10, AC-11, AC-13) ───────────────────────────

  async listScenarios(): Promise<ScenarioData[]> {
    const rows = await this.prisma.configSistema.findMany({
      where: { chave: { startsWith: SCENARIO_KEY_PREFIX } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return rows.map((r) => r.valor as unknown as ScenarioData);
  }

  async createScenario(dto: CreateScenarioDto, userId?: string): Promise<ScenarioData> {
    const id = randomUUID();
    const scenario: ScenarioData = {
      id,
      name: dto.name,
      description: dto.description ?? '',
      adjustments: {
        globalMultiplier: dto.adjustments.globalMultiplier,
        classMultipliers: dto.adjustments.classMultipliers,
        skuOverrides: dto.adjustments.skuOverrides ?? [],
      },
      createdAt: new Date().toISOString(),
      createdBy: userId ?? null,
    };

    await this.prisma.configSistema.create({
      data: {
        chave: `${SCENARIO_KEY_PREFIX}${id}`,
        valor: scenario as any,
        descricao: `What-If Scenario: ${dto.name}`,
      },
    });

    return scenario;
  }

  async getScenario(id: string): Promise<ScenarioData> {
    const row = await this.prisma.configSistema.findUnique({
      where: { chave: `${SCENARIO_KEY_PREFIX}${id}` },
    });

    if (!row) {
      throw new NotFoundException(`Scenario ${id} not found`);
    }

    return row.valor as unknown as ScenarioData;
  }

  async deleteScenario(id: string): Promise<void> {
    const key = `${SCENARIO_KEY_PREFIX}${id}`;
    try {
      await this.prisma.configSistema.delete({ where: { chave: key } });
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new NotFoundException(`Scenario ${id} not found`);
      }
      throw error;
    }
  }

  // ── Impact Analysis (AC-6..9, AC-12) ─────────────────────

  async computeImpact(id: string): Promise<ScenarioImpact> {
    const scenario = await this.getScenario(id);

    // Get baseline data
    const [baseline, forecastBaseline] = await Promise.all([
      this.getBaselineMetrics(),
      this.getBaselineForecast(),
    ]);

    // Apply scenario multipliers to compute adjusted metrics
    const scenarioMetrics = this.applyScenarioMultipliers(baseline, scenario);
    const delta = this.computeDelta(baseline, scenarioMetrics);

    // Forecast comparison (AC-6)
    const forecastComparison = this.computeForecastComparison(
      forecastBaseline,
      scenario,
    );

    return {
      scenarioId: id,
      baseline,
      scenario: scenarioMetrics,
      delta,
      forecastComparison,
    };
  }

  private async getBaselineMetrics(): Promise<ImpactMetrics> {
    const [purchaseOrders, productionOrders, totalValue, inventoryValue] =
      await Promise.all([
        this.prisma.ordemPlanejada.count({
          where: { tipo: 'COMPRA', status: { not: 'CANCELADA' } },
        }),
        this.prisma.ordemPlanejada.count({
          where: { tipo: 'PRODUCAO', status: { not: 'CANCELADA' } },
        }),
        this.prisma.ordemPlanejada.aggregate({
          _sum: { custoEstimado: true },
          where: { status: { not: 'CANCELADA' } },
        }),
        this.prisma.$queryRaw<{ total: number | null }[]>`
          SELECT SUM(
            CAST(quantidade_disponivel AS NUMERIC) * COALESCE(CAST(custo_medio_unitario AS NUMERIC), 0)
          ) AS total
          FROM inventario_atual
        `,
      ]);

    // Capacity utilization: rough average from recent events
    const capacityEvents = await this.prisma.eventoCapacidade.findMany({
      orderBy: { dataEvento: 'desc' },
      take: 100,
      select: { valorNovo: true },
    });

    let avgCapacity = 0;
    if (capacityEvents.length > 0) {
      const utilizations = capacityEvents
        .map((e) => parseFloat(e.valorNovo ?? '0'))
        .filter((v) => !isNaN(v) && v > 0);
      avgCapacity = utilizations.length > 0
        ? utilizations.reduce((s, v) => s + v, 0) / utilizations.length
        : 0;
    }

    return {
      totalPlannedOrders: purchaseOrders + productionOrders,
      purchaseOrderCount: purchaseOrders,
      productionOrderCount: productionOrders,
      totalOrderValue: Number(totalValue._sum.custoEstimado ?? 0),
      avgCapacityUtilization: Math.round(avgCapacity * 100) / 100,
      totalInventoryValue: Number(inventoryValue[0]?.total ?? 0),
    };
  }

  private async getBaselineForecast(): Promise<ForecastComparisonPoint[]> {
    const now = new Date();
    const endForecast = new Date(now.getFullYear(), now.getMonth() + 6, 0);

    const forecasts = await this.prisma.forecastResultado.findMany({
      where: { periodo: { gte: now, lte: endForecast } },
      orderBy: { periodo: 'asc' },
      take: 500,
      select: { periodo: true, faturamentoP50: true, p50: true },
    });

    // Group by month
    const monthMap = new Map<string, number>();
    for (const f of forecasts) {
      const key = f.periodo.toISOString().slice(0, 7);
      const revenue = Number(f.faturamentoP50 ?? f.p50 ?? 0);
      monthMap.set(key, (monthMap.get(key) ?? 0) + revenue);
    }

    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, revenue]) => ({
        period,
        baselineRevenue: revenue,
        scenarioRevenue: revenue,
      }));
  }

  private applyScenarioMultipliers(
    baseline: ImpactMetrics,
    scenario: ScenarioData,
  ): ImpactMetrics {
    const { globalMultiplier } = scenario.adjustments;

    // Simplified simulation: scale orders & value by demand multiplier
    return {
      totalPlannedOrders: Math.round(baseline.totalPlannedOrders * globalMultiplier),
      purchaseOrderCount: Math.round(baseline.purchaseOrderCount * globalMultiplier),
      productionOrderCount: Math.round(baseline.productionOrderCount * globalMultiplier),
      totalOrderValue: Math.round(baseline.totalOrderValue * globalMultiplier * 100) / 100,
      avgCapacityUtilization: Math.min(
        100,
        Math.round(baseline.avgCapacityUtilization * globalMultiplier * 100) / 100,
      ),
      totalInventoryValue: Math.round(baseline.totalInventoryValue * globalMultiplier * 100) / 100,
    };
  }

  private computeDelta(baseline: ImpactMetrics, scenario: ImpactMetrics): ImpactDelta {
    return {
      plannedOrdersDelta: scenario.totalPlannedOrders - baseline.totalPlannedOrders,
      orderValueDelta: Math.round((scenario.totalOrderValue - baseline.totalOrderValue) * 100) / 100,
      capacityDelta: Math.round((scenario.avgCapacityUtilization - baseline.avgCapacityUtilization) * 100) / 100,
      inventoryDelta: Math.round((scenario.totalInventoryValue - baseline.totalInventoryValue) * 100) / 100,
    };
  }

  private computeForecastComparison(
    baselineForecasts: ForecastComparisonPoint[],
    scenario: ScenarioData,
  ): ForecastComparisonPoint[] {
    const { globalMultiplier } = scenario.adjustments;

    return baselineForecasts.map((p) => ({
      ...p,
      scenarioRevenue: Math.round(p.baselineRevenue * globalMultiplier * 100) / 100,
    }));
  }
}
