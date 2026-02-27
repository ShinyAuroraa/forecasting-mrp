import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import type {
  DailySummaryData,
  SkuAlert,
  SupplierSummary,
  CapacitySummary,
  WeeklyMape,
} from './daily-summary.types';

/**
 * EmailAggregatorService — Aggregates data from multiple tables for email content.
 *
 * Queries: Notificacao (alerts), OrdemPlanejada (purchases),
 * EventoCapacidade (capacity), ForecastMetrica (accuracy),
 * ExecucaoPlanejamento (pipeline status).
 *
 * Each section is independent and fails gracefully if data is unavailable.
 *
 * @see Story 4.7 — AC-2 through AC-8
 */
@Injectable()
export class EmailAggregatorService {
  private readonly logger = new Logger(EmailAggregatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async aggregateDailySummary(executionId?: string): Promise<DailySummaryData> {
    const today = new Date();
    const dateStr = today.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const [stockAlerts, urgentPurchases, capacity, forecastAccuracy, pipelineSummary] =
      await Promise.all([
        this.getStockAlerts(),
        this.getUrgentPurchases(),
        this.getCapacitySummary(),
        this.getForecastAccuracy(),
        executionId ? this.getPipelineSummary(executionId) : Promise.resolve(null),
      ]);

    return {
      date: dateStr,
      stockAlerts,
      urgentPurchases,
      capacity,
      forecastAccuracy,
      pipelineSummary,
    };
  }

  private async getStockAlerts(): Promise<DailySummaryData['stockAlerts']> {
    try {
      const recentAlerts = await this.prisma.notificacao.findMany({
        where: {
          tipo: { in: ['STOCKOUT'] as any },
          createdAt: { gte: this.oneDayAgo() },
        },
        include: { produto: { select: { codigo: true, descricao: true } } } as any,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });

      const belowSafetyStock = recentAlerts.filter(
        (a) => (a.metadata as Record<string, unknown>)?.subtype === 'below_safety_stock',
      ).length;

      const approachingRop = recentAlerts.filter(
        (a) => (a.metadata as Record<string, unknown>)?.subtype === 'approaching_rop',
      ).length;

      const criticalSkus: SkuAlert[] = recentAlerts
        .filter((a) => a.severidade === 'CRITICAL' || a.severidade === 'HIGH')
        .slice(0, 5)
        .map((a) => {
          const meta = (a.metadata ?? {}) as Record<string, unknown>;
          return {
            codigo: (a as any).produto?.codigo ?? a.entityId ?? 'N/A',
            descricao: (a as any).produto?.descricao ?? a.titulo,
            estoqueAtual: (meta.currentStock as number) ?? 0,
            estoqueSeguranca: (meta.safetyStock as number) ?? 0,
            pontoReposicao: (meta.reorderPoint as number) ?? 0,
            severity: a.severidade as 'CRITICAL' | 'HIGH',
          };
        });

      return { belowSafetyStock, approachingRop, criticalSkus };
    } catch (error) {
      this.logger.warn(`Stock alerts aggregation failed: ${(error as Error).message}`);
      return { belowSafetyStock: 0, approachingRop: 0, criticalSkus: [] };
    }
  }

  private async getUrgentPurchases(): Promise<DailySummaryData['urgentPurchases']> {
    try {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const orders = await this.prisma.ordemPlanejada.findMany({
        where: {
          tipo: 'COMPRA',
          status: { in: ['PLANEJADA', 'FIRME'] },
          dataNecessidade: { lte: sevenDaysFromNow },
        },
        include: {
          fornecedor: { select: { razaoSocial: true } },
        },
        orderBy: { custoEstimado: 'desc' },
        take: 200,
      });

      const totalValue = orders.reduce(
        (sum, o) => sum + Number(o.custoEstimado ?? 0),
        0,
      );

      // Group by supplier
      const supplierMap = new Map<string, { nome: string; pedidos: number; valor: number }>();
      for (const order of orders) {
        const nome = order.fornecedor?.razaoSocial ?? 'Sem fornecedor';
        const existing = supplierMap.get(nome) ?? { nome, pedidos: 0, valor: 0 };
        supplierMap.set(nome, {
          nome,
          pedidos: existing.pedidos + 1,
          valor: existing.valor + Number(order.custoEstimado ?? 0),
        });
      }

      const topSuppliers: SupplierSummary[] = [...supplierMap.values()]
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5)
        .map((s) => ({
          fornecedorNome: s.nome,
          totalPedidos: s.pedidos,
          valorTotal: s.valor,
        }));

      return { totalValue, orderCount: orders.length, topSuppliers };
    } catch (error) {
      this.logger.warn(`Urgent purchases aggregation failed: ${(error as Error).message}`);
      return { totalValue: 0, orderCount: 0, topSuppliers: [] };
    }
  }

  private async getCapacitySummary(): Promise<DailySummaryData['capacity']> {
    try {
      const recentEvents = await (this.prisma.eventoCapacidade as any).findMany({
        where: {
          periodoInicio: { gte: this.oneDayAgo() },
        },
        include: {
          centroTrabalho: { select: { nome: true } },
        },
        orderBy: { utilizacaoPct: 'desc' },
        take: 20,
      }) as any[];

      const overloadedCenters: CapacitySummary[] = recentEvents
        .filter((e) => Number(e.utilizacaoPct) > 85)
        .slice(0, 10)
        .map((e) => ({
          centroTrabalho: e.centroTrabalho?.nome ?? 'N/A',
          utilizacaoPct: Number(e.utilizacaoPct),
          status: Number(e.utilizacaoPct) > 110 ? 'OVERLOADED' as const
            : Number(e.utilizacaoPct) > 85 ? 'WARNING' as const
            : 'NORMAL' as const,
        }));

      const totalOverloadAlerts = recentEvents.filter(
        (e) => Number(e.utilizacaoPct) > 110,
      ).length;

      return { overloadedCenters, totalOverloadAlerts };
    } catch (error) {
      this.logger.warn(`Capacity aggregation failed: ${(error as Error).message}`);
      return { overloadedCenters: [], totalOverloadAlerts: 0 };
    }
  }

  private async getForecastAccuracy(): Promise<DailySummaryData['forecastAccuracy']> {
    try {
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

      const metrics = await this.prisma.forecastMetrica.findMany({
        where: {
          createdAt: { gte: fourWeeksAgo },
        },
        select: {
          mape: true,
          classeAbc: true,
          createdAt: true,
        },
        take: 1000,
      });

      // Average MAPE by ABC class
      const classMapeMap = new Map<string, number[]>();
      for (const m of metrics) {
        const cls = m.classeAbc ?? 'N/A';
        const list = classMapeMap.get(cls) ?? [];
        list.push(Number(m.mape));
        classMapeMap.set(cls, list);
      }

      const byClass: Record<string, number | null> = {};
      for (const [cls, values] of classMapeMap) {
        byClass[cls] = values.length > 0
          ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
          : null;
      }

      // Weekly trend
      const weeklyTrend: WeeklyMape[] = [];
      for (let w = 3; w >= 0; w--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (w + 1) * 7);
        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() - w * 7);

        const weekMetrics = metrics.filter(
          (m) => m.createdAt >= weekStart && m.createdAt < weekEnd,
        );

        const weekByClass = new Map<string, number[]>();
        for (const m of weekMetrics) {
          const cls = m.classeAbc ?? 'N/A';
          const list = weekByClass.get(cls) ?? [];
          list.push(Number(m.mape));
          weekByClass.set(cls, list);
        }

        const avg = (vals: number[] | undefined) =>
          vals && vals.length > 0
            ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
            : null;

        weeklyTrend.push({
          weekLabel: `Sem ${4 - w}`,
          classeA: avg(weekByClass.get('A')),
          classeB: avg(weekByClass.get('B')),
          classeC: avg(weekByClass.get('C')),
        });
      }

      return { byClass, weeklyTrend };
    } catch (error) {
      this.logger.warn(`Forecast accuracy aggregation failed: ${(error as Error).message}`);
      return { byClass: {}, weeklyTrend: [] };
    }
  }

  private async getPipelineSummary(
    executionId: string,
  ): Promise<DailySummaryData['pipelineSummary']> {
    try {
      const execution = await this.prisma.execucaoPlanejamento.findUnique({
        where: { id: executionId },
      });

      if (!execution) return null;

      const summary = (execution.resultadoResumo ?? {}) as Record<string, unknown>;
      return {
        stepsCompleted: (summary.stepsCompleted as number) ?? 0,
        stepsFailed: (summary.stepsFailed as number) ?? 0,
        stepsSkipped: (summary.stepsSkipped as number) ?? 0,
        durationMs: (summary.totalDurationMs as number) ?? 0,
      };
    } catch (error) {
      this.logger.warn(`Pipeline summary aggregation failed: ${(error as Error).message}`);
      return null;
    }
  }

  private oneDayAgo(): Date {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }
}
