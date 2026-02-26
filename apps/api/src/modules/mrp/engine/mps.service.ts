import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import type {
  MpsDemandBucket,
  MpsInput,
  MpsOutput,
  MpsProductResult,
} from './interfaces/mps.interface';

/**
 * Default configuration values for MPS generation.
 * Used when ConfigSistema keys are absent or when no override is provided.
 */
const MPS_DEFAULTS = {
  PLANNING_HORIZON_WEEKS: 13,
  FIRM_ORDER_HORIZON_WEEKS: 2,
} as const;

/**
 * ConfigSistema keys for MPS parameters.
 */
const CONFIG_KEYS = {
  PLANNING_HORIZON: 'mrp.planning_horizon_weeks',
  FIRM_ORDER_HORIZON: 'mrp.firm_order_horizon_weeks',
} as const;

/**
 * MpsService — Master Production Schedule Generation
 *
 * Generates a time-phased demand schedule (weekly buckets) for all
 * finished products (tipoProduto = ACABADO). The MPS output feeds
 * BOM explosion as level-0 gross requirements.
 *
 * Demand rule (AC-2, AC-3, AC-4):
 *   Within firm-order horizon: demand = MAX(forecast_P50, firm_orders)
 *   Beyond firm-order horizon: demand = forecast_P50 only
 *
 * Data sources:
 *   - ForecastResultado (latest CONCLUIDO execution, targetType = VOLUME)
 *   - OrdemPlanejada (status = FIRME, tipo = PRODUCAO)
 *   - ConfigSistema (planning horizon, firm-order horizon)
 *
 * @see Story 3.6 — Master Production Schedule
 * @see FR-034 — MPS Generation
 */
@Injectable()
export class MpsService {
  private readonly logger = new Logger(MpsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate the Master Production Schedule for all finished products.
   *
   * @param input - Optional overrides for planning parameters
   * @returns MPS output with time-phased demand per product
   */
  async generateMps(input?: Partial<MpsInput>): Promise<MpsOutput> {
    // Step 1: Load configuration and merge with overrides
    const config = await this.loadConfig();
    const planningHorizonWeeks =
      input?.planningHorizonWeeks ?? config.planningHorizonWeeks;
    const firmOrderHorizonWeeks =
      input?.firmOrderHorizonWeeks ?? config.firmOrderHorizonWeeks;
    const startDate = input?.startDate
      ? this.getStartOfWeek(input.startDate)
      : this.getStartOfWeek(new Date());

    // Step 2: Generate weekly time buckets
    const weeklyBuckets = this.generateWeeklyBuckets(
      startDate,
      planningHorizonWeeks,
    );

    // Step 3: Load all active finished products (ACABADO)
    const finishedProducts = await this.loadFinishedProducts();

    if (finishedProducts.length === 0) {
      this.logger.warn('No active finished products (ACABADO) found');
      return {
        generatedAt: new Date(),
        planningHorizonWeeks,
        firmOrderHorizonWeeks,
        products: new Map(),
        totalProductsProcessed: 0,
        totalDemandPlanned: 0,
      };
    }

    const productIds = finishedProducts.map((p) => p.id);

    // Step 4: Load forecast data (latest CONCLUIDO execution)
    const forecastData = await this.loadLatestForecastData(productIds);

    // Step 5: Load firm orders within planning horizon
    const endDate = weeklyBuckets[weeklyBuckets.length - 1].periodEnd;
    const firmOrderData = await this.loadFirmOrders(
      productIds,
      startDate,
      endDate,
    );

    // Step 6: Calculate demand for each product
    const productsMap = new Map<string, MpsProductResult>();
    let totalDemandPlanned = 0;

    for (const product of finishedProducts) {
      const productForecast = forecastData.get(product.id) ?? new Map();
      const productFirmOrders = firmOrderData.get(product.id) ?? new Map();

      const { demandBuckets, warnings } = this.calculateDemand(
        weeklyBuckets,
        productForecast,
        productFirmOrders,
        firmOrderHorizonWeeks,
        product.id,
        product.codigo,
      );

      const productDemand = demandBuckets.reduce(
        (sum, b) => sum + b.mpsDemand,
        0,
      );
      totalDemandPlanned += productDemand;

      productsMap.set(product.id, {
        produtoId: product.id,
        codigo: product.codigo,
        descricao: product.descricao,
        demandBuckets,
        warnings,
      });
    }

    // Step 7: Log summary (AC-10)
    this.logger.log(
      `MPS generated: ${finishedProducts.length} products processed, ` +
        `${Math.round(totalDemandPlanned * 10000) / 10000} total demand planned, ` +
        `${planningHorizonWeeks} week horizon, ` +
        `${firmOrderHorizonWeeks} week firm-order horizon`,
    );

    return {
      generatedAt: new Date(),
      planningHorizonWeeks,
      firmOrderHorizonWeeks,
      products: productsMap,
      totalProductsProcessed: finishedProducts.length,
      totalDemandPlanned: Math.round(totalDemandPlanned * 10000) / 10000,
    };
  }

  /**
   * Get the Monday (start of ISO week) for a given date.
   * All dates are treated as UTC.
   *
   * @param date - Any date
   * @returns The Monday at 00:00:00.000 UTC of the same ISO week
   */
  getStartOfWeek(date: Date): Date {
    const d = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const dayOfWeek = d.getUTCDay();
    // Sunday = 0, Monday = 1, ..., Saturday = 6
    // Offset to Monday: if Sunday (0), go back 6 days; otherwise go back (day - 1)
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    d.setUTCDate(d.getUTCDate() - offset);
    return d;
  }

  /**
   * Generate an array of weekly time buckets (Monday-Sunday).
   *
   * @param startDate - The Monday of the first week
   * @param weeks - Number of weekly buckets to generate
   * @returns Array of { periodStart, periodEnd } for each week
   */
  generateWeeklyBuckets(
    startDate: Date,
    weeks: number,
  ): { periodStart: Date; periodEnd: Date }[] {
    const buckets: { periodStart: Date; periodEnd: Date }[] = [];

    for (let i = 0; i < weeks; i++) {
      const periodStart = new Date(startDate.getTime());
      periodStart.setUTCDate(periodStart.getUTCDate() + i * 7);

      const periodEnd = new Date(periodStart.getTime());
      periodEnd.setUTCDate(periodEnd.getUTCDate() + 6);
      periodEnd.setUTCHours(23, 59, 59, 999);

      buckets.push({ periodStart, periodEnd });
    }

    return buckets;
  }

  /**
   * Load MPS configuration from ConfigSistema.
   * Falls back to defaults when keys are not found.
   *
   * @returns Planning horizon and firm-order horizon in weeks
   */
  async loadConfig(): Promise<{
    planningHorizonWeeks: number;
    firmOrderHorizonWeeks: number;
  }> {
    const configs = await this.prisma.configSistema.findMany({
      where: {
        chave: {
          in: [CONFIG_KEYS.PLANNING_HORIZON, CONFIG_KEYS.FIRM_ORDER_HORIZON],
        },
      },
    });

    let planningHorizonWeeks: number = MPS_DEFAULTS.PLANNING_HORIZON_WEEKS;
    let firmOrderHorizonWeeks: number = MPS_DEFAULTS.FIRM_ORDER_HORIZON_WEEKS;

    for (const config of configs) {
      const value =
        typeof config.valor === 'number'
          ? config.valor
          : typeof config.valor === 'string'
            ? Number(config.valor)
            : typeof config.valor === 'object' &&
                config.valor !== null &&
                'value' in config.valor
              ? Number((config.valor as { value: unknown }).value)
              : NaN;

      if (config.chave === CONFIG_KEYS.PLANNING_HORIZON && !isNaN(value)) {
        planningHorizonWeeks = value;
      }
      if (config.chave === CONFIG_KEYS.FIRM_ORDER_HORIZON && !isNaN(value)) {
        firmOrderHorizonWeeks = value;
      }
    }

    return { planningHorizonWeeks, firmOrderHorizonWeeks };
  }

  /**
   * Load all active finished products (tipoProduto = ACABADO).
   *
   * @returns Array of product identifiers with code and description
   */
  async loadFinishedProducts(): Promise<
    { id: string; codigo: string; descricao: string }[]
  > {
    return this.prisma.produto.findMany({
      where: {
        tipoProduto: 'ACABADO',
        ativo: true,
      },
      select: {
        id: true,
        codigo: true,
        descricao: true,
      },
    });
  }

  /**
   * Load the latest forecast data from ForecastResultado.
   *
   * Finds the most recent CONCLUIDO forecast execution, then loads
   * all VOLUME-type results for the requested products.
   *
   * @param productIds - Product identifiers to load forecast data for
   * @returns Map of produtoId -> Map of weekStartTimestamp -> p50 value
   */
  async loadLatestForecastData(
    productIds: string[],
  ): Promise<Map<string, Map<number, number>>> {
    const forecastMap = new Map<string, Map<number, number>>();

    if (productIds.length === 0) {
      return forecastMap;
    }

    // Find the latest completed forecast execution
    const latestExecution = await this.prisma.execucaoPlanejamento.findFirst({
      where: {
        tipo: 'FORECAST',
        status: 'CONCLUIDO',
      },
      orderBy: {
        completedAt: 'desc',
      },
      select: {
        id: true,
      },
    });

    if (latestExecution === null) {
      this.logger.warn(
        'No completed forecast execution found — MPS will use firm orders only',
      );
      return forecastMap;
    }

    // Load forecast results for VOLUME target type
    const forecastResults = await this.prisma.forecastResultado.findMany({
      where: {
        execucaoId: latestExecution.id,
        targetType: 'VOLUME',
        produtoId: { in: productIds },
      },
      select: {
        produtoId: true,
        periodo: true,
        p50: true,
      },
    });

    // Group by produtoId and period (week-start timestamp)
    for (const result of forecastResults) {
      const weekStart = this.getStartOfWeek(result.periodo);
      const weekTimestamp = weekStart.getTime();
      const p50Value =
        result.p50 !== null && result.p50 !== undefined
          ? typeof result.p50 === 'number'
            ? result.p50
            : result.p50.toNumber()
          : 0;

      let productMap = forecastMap.get(result.produtoId);
      if (productMap === undefined) {
        productMap = new Map<number, number>();
        forecastMap.set(result.produtoId, productMap);
      }

      // Accumulate in case multiple forecast rows fall in the same week
      const existing = productMap.get(weekTimestamp) ?? 0;
      productMap.set(
        weekTimestamp,
        Math.round((existing + p50Value) * 10000) / 10000,
      );
    }

    return forecastMap;
  }

  /**
   * Load firm orders (status = FIRME, tipo = PRODUCAO) within the planning horizon.
   *
   * @param productIds - Product identifiers to load firm orders for
   * @param startDate - Start of planning horizon
   * @param endDate - End of planning horizon
   * @returns Map of produtoId -> Map of weekStartTimestamp -> total quantity
   */
  async loadFirmOrders(
    productIds: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<Map<string, Map<number, number>>> {
    const firmOrderMap = new Map<string, Map<number, number>>();

    if (productIds.length === 0) {
      return firmOrderMap;
    }

    const orders = await this.prisma.ordemPlanejada.findMany({
      where: {
        status: 'FIRME',
        tipo: 'PRODUCAO',
        produtoId: { in: productIds },
        dataNecessidade: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        produtoId: true,
        dataNecessidade: true,
        quantidade: true,
      },
    });

    // Group by produtoId and week-start timestamp
    for (const order of orders) {
      const weekStart = this.getStartOfWeek(order.dataNecessidade);
      const weekTimestamp = weekStart.getTime();
      const qty =
        typeof order.quantidade === 'number'
          ? order.quantidade
          : order.quantidade.toNumber();

      let productMap = firmOrderMap.get(order.produtoId);
      if (productMap === undefined) {
        productMap = new Map<number, number>();
        firmOrderMap.set(order.produtoId, productMap);
      }

      const existing = productMap.get(weekTimestamp) ?? 0;
      productMap.set(
        weekTimestamp,
        Math.round((existing + qty) * 10000) / 10000,
      );
    }

    return firmOrderMap;
  }

  /**
   * Calculate MPS demand for a single product across all weekly buckets.
   *
   * Demand rule:
   *   - Within firm-order horizon (bucket index < firmOrderHorizonWeeks):
   *     mpsDemand = MAX(forecastDemand, firmOrderDemand)
   *   - Beyond firm-order horizon:
   *     mpsDemand = forecastDemand only
   *
   * @param weeklyBuckets - Array of weekly time buckets
   * @param forecastData - Map of weekStartTimestamp -> forecast P50 value
   * @param firmOrderData - Map of weekStartTimestamp -> total firm-order quantity
   * @param firmOrderHorizonWeeks - Number of weeks for firm-order horizon
   * @param produtoId - Product identifier (for warning messages)
   * @param codigo - Product code (for warning messages)
   * @returns Demand buckets and warnings
   */
  calculateDemand(
    weeklyBuckets: { periodStart: Date; periodEnd: Date }[],
    forecastData: Map<number, number>,
    firmOrderData: Map<number, number>,
    firmOrderHorizonWeeks: number,
    produtoId: string,
    codigo: string,
  ): { demandBuckets: MpsDemandBucket[]; warnings: string[] } {
    const demandBuckets: MpsDemandBucket[] = [];
    const warnings: string[] = [];

    const hasForecast = forecastData.size > 0;
    const hasFirmOrders = firmOrderData.size > 0;

    // AC-8: If no forecast exists, warn
    if (!hasForecast) {
      warnings.push(
        `No forecast data for product ${codigo} (${produtoId}) — using firm orders only`,
      );
    }

    // AC-9: If no firm orders exist (informational, not a warning level concern)
    if (!hasFirmOrders && hasForecast) {
      // No firm orders is normal — forecast-only is a valid scenario
    }

    for (let i = 0; i < weeklyBuckets.length; i++) {
      const bucket = weeklyBuckets[i];
      const weekTimestamp = bucket.periodStart.getTime();

      const forecastDemand = forecastData.get(weekTimestamp) ?? 0;
      const firmOrderDemand = firmOrderData.get(weekTimestamp) ?? 0;

      let mpsDemand: number;

      if (i < firmOrderHorizonWeeks) {
        // AC-2, AC-3: Within firm-order horizon, MAX rule applies
        mpsDemand = Math.max(forecastDemand, firmOrderDemand);
      } else {
        // AC-4: Beyond firm-order horizon, forecast only
        mpsDemand = forecastDemand;
      }

      mpsDemand = Math.round(mpsDemand * 10000) / 10000;

      demandBuckets.push({
        periodStart: bucket.periodStart,
        periodEnd: bucket.periodEnd,
        forecastDemand: Math.round(forecastDemand * 10000) / 10000,
        firmOrderDemand: Math.round(firmOrderDemand * 10000) / 10000,
        mpsDemand,
      });
    }

    return { demandBuckets, warnings };
  }
}
