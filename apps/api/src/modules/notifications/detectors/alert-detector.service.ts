import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificacaoService } from '../notificacao.service';
import type { CreateAlertDto } from '../notification.types';

/**
 * Alert Detector Service
 *
 * Runs periodic checks against the database and triggers alerts
 * when threshold conditions are met.
 *
 * Detection rules:
 * - STOCKOUT: projected stock < 0 within 2 weeks (AC-5)
 * - URGENT_PURCHASE: planned orders with release date within 7 days (AC-6)
 * - CAPACITY_OVERLOAD: work center utilization > 110% (AC-7)
 * - FORECAST_DEVIATION: actual vs forecast MAPE > threshold (AC-8)
 * - STORAGE_FULL: warehouse occupancy > 90% (AC-9)
 * - PIPELINE_FAILURE: triggered externally via create() (AC-10)
 *
 * @see Story 4.4 — AC-5 through AC-10
 */
@Injectable()
export class AlertDetectorService {
  private readonly logger = new Logger(AlertDetectorService.name);
  private forecastDeviationThreshold = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacaoService: NotificacaoService,
  ) {}

  /**
   * Run all detection checks every 30 minutes.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async runAllChecks(): Promise<void> {
    this.logger.log('Running alert detection checks...');
    await Promise.allSettled([
      this.detectStockout(),
      this.detectUrgentPurchase(),
      this.detectCapacityOverload(),
      this.detectForecastDeviation(),
      this.detectStorageFull(),
    ]);
    this.logger.log('Alert detection checks completed.');
  }

  /**
   * AC-5: STOCKOUT — projected stock < 0 for any SKU within 2 weeks.
   * Checks both currently negative stock and planned orders that will
   * consume stock within the next 14 days.
   */
  async detectStockout(): Promise<void> {
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

    // Find items with negative available stock OR items with planned demand
    // within 2 weeks that exceeds current stock
    const atRisk = await this.prisma.inventarioAtual.findMany({
      where: {
        OR: [
          { quantidadeDisponivel: { lt: 0 } },
          {
            produto: {
              ordensPlanejadas: {
                some: {
                  tipo: 'PRODUCAO',
                  dataInicio: { lte: twoWeeksFromNow },
                  status: 'PLANNED',
                },
              },
            },
          },
        ],
      },
      include: { produto: { select: { id: true, sku: true, descricao: true } } },
      take: 100,
    });

    for (const item of atRisk) {
      const existing = await this.findRecentAlert('STOCKOUT', item.produto.id);
      if (existing) continue;

      const alert: CreateAlertDto = {
        tipo: 'STOCKOUT',
        severidade: 'CRITICAL',
        titulo: `Risco de ruptura: ${item.produto.sku}`,
        mensagem: `Produto ${item.produto.descricao} (${item.produto.sku}) com estoque projetado negativo: ${item.quantidadeDisponivel} unidades.`,
        entityId: item.produto.id,
        entityType: 'Produto',
        metadata: {
          sku: item.produto.sku,
          quantidadeDisponivel: item.quantidadeDisponivel,
        },
      };
      await this.notificacaoService.create(alert);
    }
  }

  /**
   * AC-6: URGENT_PURCHASE — planned orders with release date within 7 days.
   */
  async detectUrgentPurchase(): Promise<void> {
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const urgentOrders = await this.prisma.ordemPlanejada.findMany({
      where: {
        tipo: 'COMPRA',
        dataLiberacao: { gte: now, lte: sevenDaysFromNow },
        status: 'PLANNED',
      },
      include: { produto: { select: { id: true, sku: true, descricao: true } } },
      take: 100,
    });

    for (const order of urgentOrders) {
      const existing = await this.findRecentAlert('URGENT_PURCHASE', order.id);
      if (existing) continue;

      const alert: CreateAlertDto = {
        tipo: 'URGENT_PURCHASE',
        severidade: 'HIGH',
        titulo: `Compra urgente: ${order.produto.sku}`,
        mensagem: `Ordem de compra para ${order.produto.descricao} (${order.produto.sku}) com data de liberação em ${order.dataLiberacao.toISOString().split('T')[0]}. Quantidade: ${order.quantidade}.`,
        entityId: order.id,
        entityType: 'OrdemPlanejada',
        metadata: {
          sku: order.produto.sku,
          quantidade: order.quantidade,
          dataLiberacao: order.dataLiberacao.toISOString(),
        },
      };
      await this.notificacaoService.create(alert);
    }
  }

  /**
   * AC-7: CAPACITY_OVERLOAD — work center utilization > 110%.
   */
  async detectCapacityOverload(): Promise<void> {
    const events = await this.prisma.eventoCapacidade.findMany({
      where: { utilizacaoPct: { gt: 110 } },
      include: { centroTrabalho: { select: { id: true, nome: true, codigo: true } } },
      orderBy: { periodoInicio: 'desc' },
      take: 100,
    });

    for (const event of events) {
      const existing = await this.findRecentAlert('CAPACITY_OVERLOAD', event.centroTrabalho.id);
      if (existing) continue;

      const alert: CreateAlertDto = {
        tipo: 'CAPACITY_OVERLOAD',
        severidade: event.utilizacaoPct > 150 ? 'CRITICAL' : 'HIGH',
        titulo: `Sobrecarga: ${event.centroTrabalho.nome}`,
        mensagem: `Centro de trabalho ${event.centroTrabalho.codigo} (${event.centroTrabalho.nome}) com utilização de ${event.utilizacaoPct.toFixed(1)}% no período ${event.periodoInicio.toISOString().split('T')[0]}.`,
        entityId: event.centroTrabalho.id,
        entityType: 'CentroTrabalho',
        metadata: {
          codigo: event.centroTrabalho.codigo,
          utilizacaoPct: event.utilizacaoPct,
          periodoInicio: event.periodoInicio.toISOString(),
        },
      };
      await this.notificacaoService.create(alert);
    }
  }

  /**
   * AC-8: FORECAST_DEVIATION — actual vs forecast MAPE > threshold.
   */
  async detectForecastDeviation(): Promise<void> {
    const results = await this.prisma.resultadoForecast.findMany({
      where: { mape: { gt: this.forecastDeviationThreshold } },
      include: { produto: { select: { id: true, sku: true, descricao: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    for (const result of results) {
      const existing = await this.findRecentAlert('FORECAST_DEVIATION', result.produto.id);
      if (existing) continue;

      const alert: CreateAlertDto = {
        tipo: 'FORECAST_DEVIATION',
        severidade: result.mape > 50 ? 'HIGH' : 'MEDIUM',
        titulo: `Desvio de forecast: ${result.produto.sku}`,
        mensagem: `Produto ${result.produto.descricao} (${result.produto.sku}) com MAPE de ${result.mape.toFixed(1)}% (limiar: ${this.forecastDeviationThreshold}%).`,
        entityId: result.produto.id,
        entityType: 'Produto',
        metadata: {
          sku: result.produto.sku,
          mape: result.mape,
          threshold: this.forecastDeviationThreshold,
        },
      };
      await this.notificacaoService.create(alert);
    }
  }

  /**
   * AC-9: STORAGE_FULL — warehouse occupancy > 90%.
   */
  async detectStorageFull(): Promise<void> {
    const depositos = await this.prisma.deposito.findMany({
      where: { ativo: true },
      select: {
        id: true,
        nome: true,
        codigo: true,
        capacidadeM3: true,
        ocupacaoAtualM3: true,
      },
    });

    for (const dep of depositos) {
      if (!dep.capacidadeM3 || dep.capacidadeM3 === 0) continue;

      const occupancyPct = ((dep.ocupacaoAtualM3 ?? 0) / dep.capacidadeM3) * 100;
      if (occupancyPct <= 90) continue;

      const existing = await this.findRecentAlert('STORAGE_FULL', dep.id);
      if (existing) continue;

      const alert: CreateAlertDto = {
        tipo: 'STORAGE_FULL',
        severidade: occupancyPct > 95 ? 'CRITICAL' : 'HIGH',
        titulo: `Depósito quase cheio: ${dep.nome}`,
        mensagem: `Depósito ${dep.codigo} (${dep.nome}) com ${occupancyPct.toFixed(1)}% de ocupação (${dep.ocupacaoAtualM3?.toFixed(1) ?? 0}/${dep.capacidadeM3.toFixed(1)} m³).`,
        entityId: dep.id,
        entityType: 'Deposito',
        metadata: {
          codigo: dep.codigo,
          occupancyPct,
          capacidadeM3: dep.capacidadeM3,
          ocupacaoAtualM3: dep.ocupacaoAtualM3,
        },
      };
      await this.notificacaoService.create(alert);
    }
  }

  /**
   * AC-10: PIPELINE_FAILURE — triggered externally (e.g., from BullMQ processor).
   * This is called directly by other services, not by the cron job.
   */
  async triggerPipelineFailure(
    pipelineName: string,
    errorMessage: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const alert: CreateAlertDto = {
      tipo: 'PIPELINE_FAILURE',
      severidade: 'CRITICAL',
      titulo: `Falha no pipeline: ${pipelineName}`,
      mensagem: errorMessage,
      entityType: 'Pipeline',
      metadata: { pipelineName, ...metadata },
    };
    await this.notificacaoService.create(alert);
  }

  /**
   * Update the configurable MAPE threshold.
   * @param threshold Must be between 1 and 100.
   */
  setForecastDeviationThreshold(threshold: number): void {
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 100) {
      throw new Error(`Invalid threshold: ${threshold}. Must be between 1 and 100.`);
    }
    this.forecastDeviationThreshold = threshold;
  }

  /**
   * Find a recent (last 24h) unacknowledged alert for deduplication.
   */
  private async findRecentAlert(
    tipo: string,
    entityId: string,
  ): Promise<boolean> {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const count = await this.prisma.notificacao.count({
      where: {
        tipo: tipo as any,
        entityId,
        acknowledgedAt: null,
        createdAt: { gte: oneDayAgo },
      },
    });
    return count > 0;
  }
}
