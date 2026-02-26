import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import type {
  DemandStatistics,
  HistogramBucket,
  LeadTimeData,
  MonteCarloInput,
  MonteCarloResult,
  StockCalcMethod,
  StockParamsProductData,
  StockParamsResult,
  TftForecastRow,
} from './interfaces/stock-params.interface';

/**
 * StockParamsService — Stock Parameter Calculation Engine
 *
 * Calculates safety stock (SS), reorder point (ROP), EOQ, min, and max
 * for a given SKU, persisting results to the parametros_estoque table.
 *
 * Two calculation paths for safety stock:
 *   - TFT_QUANTIL: Uses TFT forecast quantile differences (AC-2)
 *   - FORMULA_CLASSICA: Uses Z * sqrt(LT * sigma_d^2 + d_bar^2 * sigma_LT^2) (AC-3)
 *
 * Key decisions:
 *   - AC-11: Manual override (estoqueSegurancaManual) takes precedence
 *   - AC-6: Min = ROP
 *   - AC-7: Max = d_bar * (LT + R) + SS
 *   - AC-8: Results persisted to ParametrosEstoque linked to execucaoId
 *   - AC-9: Calculation method recorded (TFT_QUANTIL or FORMULA_CLASSICA)
 *
 * @see Story 3.3 — Stock Parameter Calculation
 */
@Injectable()
export class StockParamsService {
  private static readonly DECIMAL_PLACES = 4;
  private static readonly ROUNDING_FACTOR = Math.pow(10, StockParamsService.DECIMAL_PLACES);

  private static readonly DEFAULT_SERVICE_LEVEL = 0.95;
  private static readonly DEFAULT_MC_ITERATIONS = 10_000;
  private static readonly MIN_WEEKS_FOR_MONTE_CARLO = 12;
  private static readonly HISTOGRAM_BUCKETS = 20;
  private static readonly DAYS_PER_WEEK = 7;
  private static readonly WEEKS_PER_YEAR = 52;

  /**
   * Z-score lookup table (AC-10).
   * Maps service level (0-1) to the corresponding Z-score.
   */
  private static readonly Z_SCORES: ReadonlyMap<number, number> = new Map([
    [0.90, 1.28],
    [0.95, 1.645],
    [0.975, 1.96],
    [0.99, 2.326],
  ]);

  /**
   * Quantile column mapping for TFT safety stock (AC-2).
   * Maps service level to the ForecastResultado quantile column to use.
   * 90% -> p75, 95%+ -> p90 (nearest available quantile).
   */
  private static readonly SERVICE_LEVEL_TO_QUANTILE: ReadonlyMap<number, 'p75' | 'p90'> = new Map([
    [0.90, 'p75'],
    [0.95, 'p90'],
    [0.975, 'p90'],
    [0.99, 'p90'],
  ]);

  private readonly logger = new Logger(StockParamsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ────────────────────────────────────────────────────────────────
  // Main Orchestration
  // ────────────────────────────────────────────────────────────────

  /**
   * Calculate and persist stock parameters for a single product.
   *
   * @param produtoId - The product identifier
   * @param execucaoId - The execution run identifier (links to ExecucaoPlanejamento)
   * @param serviceLevel - Target service level (0-1), defaults to 0.95
   * @returns The persisted ParametrosEstoque record
   */
  async calculateForProduct(
    produtoId: string,
    execucaoId: string,
    serviceLevel: number = StockParamsService.DEFAULT_SERVICE_LEVEL,
  ): Promise<StockParamsResult> {
    const produto = await this.getProductData(produtoId);
    const leadTimeData = await this.getLeadTimeData(produtoId, produto);

    // Single query for demand data — used for both stats and Monte Carlo sampling
    const demandHistory = await this.getDemandHistory(produtoId);
    const demandStats = this.computeDemandStatistics(demandHistory);

    const ltWeeks = leadTimeData.leadTimeDias / StockParamsService.DAYS_PER_WEEK;
    const sigmaLtWeeks = leadTimeData.sigmaLeadTimeDias / StockParamsService.DAYS_PER_WEEK;

    let ss: number;
    let metodo: StockCalcMethod;

    // AC-11 (Story 3.3) + AC-10 (Story 5.2): Manual override takes precedence
    if (produto.estoqueSegurancaManual !== null) {
      ss = produto.estoqueSegurancaManual;
      metodo = 'FORMULA_CLASSICA';
      this.logger.debug(
        `Product ${produtoId}: Using manual safety stock override = ${ss}`,
      );
    } else {
      // AC-6/AC-7 (Story 5.2): Class A SKUs → Monte Carlo simulation
      const abcClass = await this.getAbcClass(produtoId);

      if (
        abcClass === 'A' &&
        demandHistory.length >= StockParamsService.MIN_WEEKS_FOR_MONTE_CARLO
      ) {
        const mcResult = this.calculateSafetyStockMonteCarlo({
          demandHistory,
          leadTimeMeanWeeks: ltWeeks,
          leadTimeSigmaWeeks: sigmaLtWeeks,
          serviceLevel,
          iterations: StockParamsService.DEFAULT_MC_ITERATIONS,
        });
        ss = mcResult.safetyStock;
        metodo = 'MONTE_CARLO';
        this.logger.debug(
          `Product ${produtoId}: Monte Carlo path (Class A), SS = ${ss}, iterations = ${mcResult.iterations}`,
        );
      } else {
        // Try TFT path first (AC-2, Story 3.3)
        const tftData = await this.getTftForecastData(produtoId, Math.ceil(ltWeeks));
        if (tftData.length > 0) {
          ss = this.calculateSafetyStockTft(tftData, serviceLevel);
          metodo = 'TFT_QUANTIL';
          this.logger.debug(
            `Product ${produtoId}: TFT path, SS = ${ss}`,
          );
        } else {
          // Classical path (AC-3, Story 3.3)
          const z = this.getZScore(serviceLevel);
          ss = this.calculateSafetyStockClassical(
            z,
            ltWeeks,
            demandStats.sigmaDWeekly,
            demandStats.dBarWeekly,
            sigmaLtWeeks,
          );
          metodo = 'FORMULA_CLASSICA';
          this.logger.debug(
            `Product ${produtoId}: Classical path, Z=${z}, SS=${ss}`,
          );
        }
      }
    }

    // AC-4: Reorder Point
    const rop = this.calculateRop(demandStats.dBarWeekly, ltWeeks, ss);

    // AC-5: EOQ (Wilson formula)
    const k = produto.custoPedido ?? 0;
    const custoUnitario = produto.custoUnitario ?? 0;
    const custoManutPct = produto.custoManutencaoPctAno ?? 25;
    const h = custoUnitario * custoManutPct / 100;
    const eoq = this.calculateEoq(demandStats.dAnnual, k, h);

    // AC-6: Min = ROP
    const min = rop;

    // AC-7: Max = d_bar * (LT + R) + SS
    const rDias = produto.intervaloRevisaoDias ?? 0;
    const rWeeks = rDias / StockParamsService.DAYS_PER_WEEK;
    const max = this.calculateMax(demandStats.dBarWeekly, ltWeeks, rWeeks, ss);

    // AC-8: Persist to ParametrosEstoque
    const now = new Date();
    const record = await this.prisma.parametrosEstoque.create({
      data: {
        execucaoId,
        produtoId,
        safetyStock: ss,
        reorderPoint: rop,
        estoqueMinimo: min,
        estoqueMaximo: max,
        eoq,
        metodoCalculo: metodo,
        nivelServicoUsado: serviceLevel,
        calculatedAt: now,
      },
    });

    return {
      id: record.id,
      execucaoId: record.execucaoId,
      produtoId: record.produtoId,
      safetyStock: Number(record.safetyStock),
      reorderPoint: Number(record.reorderPoint),
      estoqueMinimo: Number(record.estoqueMinimo),
      estoqueMaximo: Number(record.estoqueMaximo),
      eoq: Number(record.eoq),
      metodoCalculo: record.metodoCalculo as StockCalcMethod,
      nivelServicoUsado: Number(record.nivelServicoUsado),
      calculatedAt: record.calculatedAt!,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Monte Carlo Simulation (public API)
  // ────────────────────────────────────────────────────────────────

  /**
   * Run a full Monte Carlo simulation for a given product (Story 5.2, AC-11/AC-12).
   *
   * Loads demand history and lead time data, runs the simulation, and returns
   * the complete result with safety stock, confidence interval, and histogram.
   *
   * @param produtoId - The product to simulate
   * @param serviceLevel - Target service level (0-1), defaults to 0.95
   * @param iterations - Number of iterations (default 10,000)
   * @returns Full MonteCarloResult
   * @throws BadRequestException if insufficient historical data
   */
  async runMonteCarloSimulation(
    produtoId: string,
    serviceLevel: number = StockParamsService.DEFAULT_SERVICE_LEVEL,
    iterations: number = StockParamsService.DEFAULT_MC_ITERATIONS,
  ): Promise<MonteCarloResult> {
    const produto = await this.getProductData(produtoId);
    const leadTimeData = await this.getLeadTimeData(produtoId, produto);
    const demandHistory = await this.getDemandHistory(produtoId);

    if (demandHistory.length < StockParamsService.MIN_WEEKS_FOR_MONTE_CARLO) {
      throw new BadRequestException(
        `Insufficient historical data for Monte Carlo simulation: ` +
        `${demandHistory.length} weeks available, minimum ${StockParamsService.MIN_WEEKS_FOR_MONTE_CARLO} required`,
      );
    }

    const ltWeeks = leadTimeData.leadTimeDias / StockParamsService.DAYS_PER_WEEK;
    const sigmaLtWeeks = leadTimeData.sigmaLeadTimeDias / StockParamsService.DAYS_PER_WEEK;

    return this.calculateSafetyStockMonteCarlo({
      demandHistory,
      leadTimeMeanWeeks: ltWeeks,
      leadTimeSigmaWeeks: sigmaLtWeeks,
      serviceLevel,
      iterations,
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Pure Calculation Methods (public for direct unit testing)
  // ────────────────────────────────────────────────────────────────

  /**
   * Calculate safety stock using TFT forecast quantiles (AC-2).
   *
   * SS = SUM(P_service over LT weeks) - SUM(P50 over LT weeks)
   *
   * The quantile column used depends on the service level:
   *   90% -> p75, 95%/97.5%/99% -> p90
   *
   * @param tftData - Array of forecast rows covering lead time weeks
   * @param serviceLevel - Target service level (0-1)
   * @returns Safety stock value (floored to 0)
   */
  calculateSafetyStockTft(tftData: readonly TftForecastRow[], serviceLevel: number): number {
    const quantileKey = this.getQuantileColumnForServiceLevel(serviceLevel);

    let sumQuantile = 0;
    let sumP50 = 0;

    for (const row of tftData) {
      sumQuantile += row[quantileKey] ?? 0;
      sumP50 += row.p50 ?? 0;
    }

    const ss = sumQuantile - sumP50;
    return this.round(Math.max(0, ss));
  }

  /**
   * Calculate safety stock using the classical formula (AC-3).
   *
   * SS = Z * sqrt(LT * sigma_d^2 + d_bar^2 * sigma_LT^2)
   *
   * @param z - Z-score for the target service level
   * @param lt - Lead time in weeks
   * @param sigmaD - Standard deviation of weekly demand
   * @param dBar - Average weekly demand
   * @param sigmaLt - Standard deviation of lead time in weeks
   * @returns Safety stock value
   */
  calculateSafetyStockClassical(
    z: number,
    lt: number,
    sigmaD: number,
    dBar: number,
    sigmaLt: number,
  ): number {
    const varianceDemand = lt * sigmaD * sigmaD;
    const varianceLeadTime = dBar * dBar * sigmaLt * sigmaLt;
    return this.round(z * Math.sqrt(varianceDemand + varianceLeadTime));
  }

  /**
   * Calculate Economic Order Quantity using the Wilson formula (AC-5).
   *
   * EOQ = sqrt(2 * D_annual * K / h)
   *
   * @param dAnnual - Annual demand
   * @param k - Ordering cost (custoPedido)
   * @param h - Holding cost per unit per year (custoUnitario * custoManutencaoPctAno / 100)
   * @returns EOQ value (0 if any input is non-positive, L4L fallback)
   */
  calculateEoq(dAnnual: number, k: number, h: number): number {
    if (k <= 0 || h <= 0 || dAnnual <= 0) {
      return 0;
    }
    return this.round(Math.sqrt((2 * dAnnual * k) / h));
  }

  /**
   * Calculate Reorder Point (AC-4).
   *
   * ROP = d_bar * LT + SS
   *
   * @param dBar - Average weekly demand
   * @param lt - Lead time in weeks
   * @param ss - Safety stock
   * @returns Reorder point value
   */
  calculateRop(dBar: number, lt: number, ss: number): number {
    return this.round(dBar * lt + ss);
  }

  /**
   * Calculate maximum stock level (AC-7).
   *
   * Max = d_bar * (LT + R) + SS
   *
   * @param dBar - Average weekly demand
   * @param lt - Lead time in weeks
   * @param r - Review interval in weeks (intervaloRevisaoDias / 7)
   * @param ss - Safety stock
   * @returns Maximum stock level
   */
  calculateMax(dBar: number, lt: number, r: number, ss: number): number {
    return this.round(dBar * (lt + r) + ss);
  }

  /**
   * Compute demand statistics from raw weekly volumes (in-memory, no DB query).
   * Used by calculateForProduct to derive stats from the same demand history
   * that feeds Monte Carlo, avoiding a redundant serieTemporal query.
   */
  computeDemandStatistics(volumes: readonly number[]): DemandStatistics {
    if (volumes.length === 0) {
      return { dBarWeekly: 0, sigmaDWeekly: 0, dAnnual: 0 };
    }

    const n = volumes.length;
    const sum = volumes.reduce((acc, v) => acc + v, 0);
    const dBar = sum / n;
    const squaredDiffs = volumes.reduce((acc, v) => acc + (v - dBar) * (v - dBar), 0);
    // Sample standard deviation (Bessel's correction, n-1 denominator)
    const sigmaD = n > 1 ? Math.sqrt(squaredDiffs / (n - 1)) : 0;
    const dAnnual = dBar * StockParamsService.WEEKS_PER_YEAR;

    return {
      dBarWeekly: this.round(dBar),
      sigmaDWeekly: this.round(sigmaD),
      dAnnual: this.round(dAnnual),
    };
  }

  /**
   * Calculate safety stock using Monte Carlo simulation (Story 5.2, AC-1 to AC-5).
   *
   * For each iteration:
   *   1. Sample a lead time from Normal(meanLT, sigmaLT), clamped to >= 1 day
   *   2. Sample daily demands by randomly picking from historical demand values
   *      (each daily demand = weekly demand / 7, sampled from the empirical distribution)
   *   3. total_demand = sum of sampled daily demands over sampled lead time (in days)
   *   4. After all iterations: SS = quantile(total_demands, serviceLevel) - mean(total_demands)
   *
   * @param input - Monte Carlo simulation parameters
   * @returns Full simulation result including SS, confidence interval, and histogram
   */
  calculateSafetyStockMonteCarlo(input: MonteCarloInput): MonteCarloResult {
    const { demandHistory, leadTimeMeanWeeks, leadTimeSigmaWeeks, serviceLevel, iterations } = input;
    const rng = this.createSeededRng(input.seed);

    const ltMeanDays = leadTimeMeanWeeks * StockParamsService.DAYS_PER_WEEK;
    const ltSigmaDays = leadTimeSigmaWeeks * StockParamsService.DAYS_PER_WEEK;

    // Pre-compute daily demand values from weekly history
    const dailyDemands = demandHistory.map((w) => w / StockParamsService.DAYS_PER_WEEK);

    const totalDemands: number[] = new Array(iterations);

    for (let i = 0; i < iterations; i++) {
      // Sample lead time from Normal distribution, clamped to >= 1 day
      const sampledLtDays = ltSigmaDays > 0
        ? Math.max(1, Math.round(this.sampleNormal(rng, ltMeanDays, ltSigmaDays)))
        : Math.round(ltMeanDays);

      // Sample daily demands over lead time period
      let totalDemand = 0;
      for (let d = 0; d < sampledLtDays; d++) {
        const idx = Math.floor(rng() * dailyDemands.length);
        totalDemand += dailyDemands[idx];
      }

      totalDemands[i] = totalDemand;
    }

    // Sort for quantile computation
    totalDemands.sort((a, b) => a - b);

    const mean = totalDemands.reduce((acc, v) => acc + v, 0) / iterations;
    const quantileValue = this.quantile(totalDemands, serviceLevel);
    const p5 = this.quantile(totalDemands, 0.05);
    const p95 = this.quantile(totalDemands, 0.95);

    const ss = this.round(Math.max(0, quantileValue - mean));

    const histogram = this.buildHistogram(totalDemands, StockParamsService.HISTOGRAM_BUCKETS);

    return {
      safetyStock: ss,
      iterations,
      meanDemandOverLt: this.round(mean),
      confidenceInterval: {
        p5: this.round(p5),
        p95: this.round(p95),
      },
      histogram,
    };
  }

  /**
   * Get Z-score for a given service level (AC-10).
   *
   * Standard values: 90%->1.28, 95%->1.645, 97.5%->1.96, 99%->2.326
   * For non-standard levels, returns the nearest available Z-score.
   *
   * @param serviceLevel - Service level between 0 and 1
   * @returns Z-score value
   */
  getZScore(serviceLevel: number): number {
    const z = StockParamsService.Z_SCORES.get(serviceLevel);
    if (z !== undefined) {
      return z;
    }

    // For non-standard levels, find the nearest standard level
    let nearestLevel = 0.95;
    let minDistance = Infinity;

    for (const level of StockParamsService.Z_SCORES.keys()) {
      const distance = Math.abs(level - serviceLevel);
      if (distance < minDistance) {
        minDistance = distance;
        nearestLevel = level;
      }
    }

    return StockParamsService.Z_SCORES.get(nearestLevel)!;
  }

  // ────────────────────────────────────────────────────────────────
  // Data Fetching Helpers (private)
  // ────────────────────────────────────────────────────────────────

  /**
   * Fetch product data needed for stock parameter calculation.
   */
  private async getProductData(produtoId: string): Promise<StockParamsProductData> {
    const produto = await this.prisma.produto.findUniqueOrThrow({
      where: { id: produtoId },
      select: {
        id: true,
        tipoProduto: true,
        custoUnitario: true,
        custoPedido: true,
        custoManutencaoPctAno: true,
        intervaloRevisaoDias: true,
        estoqueSegurancaManual: true,
        leadTimeProducaoDias: true,
      },
    });

    return {
      id: produto.id,
      tipoProduto: produto.tipoProduto,
      custoUnitario: produto.custoUnitario !== null ? Number(produto.custoUnitario) : null,
      custoPedido: produto.custoPedido !== null ? Number(produto.custoPedido) : null,
      custoManutencaoPctAno: produto.custoManutencaoPctAno !== null
        ? Number(produto.custoManutencaoPctAno)
        : null,
      intervaloRevisaoDias: produto.intervaloRevisaoDias,
      estoqueSegurancaManual: produto.estoqueSegurancaManual !== null
        ? Number(produto.estoqueSegurancaManual)
        : null,
      leadTimeProducaoDias: produto.leadTimeProducaoDias,
    };
  }

  /**
   * Resolve lead time data from the appropriate source.
   *
   * For COMPRA-type products (INSUMO, MATERIA_PRIMA, EMBALAGEM, REVENDA):
   *   - ProdutoFornecedor (isPrincipal=true), fallback to first supplier
   *   - sigma_LT = (leadTimeMaxDias - leadTimeMinDias) / 6 from Fornecedor
   *
   * For PRODUCAO-type products (ACABADO, SEMI_ACABADO):
   *   - Produto.leadTimeProducaoDias
   *   - sigma_LT = 0 (production lead time is deterministic)
   */
  private async getLeadTimeData(
    produtoId: string,
    produto: StockParamsProductData,
  ): Promise<LeadTimeData> {
    const isPurchased = this.isPurchasedProduct(produto.tipoProduto);

    if (isPurchased) {
      return this.getSupplierLeadTime(produtoId);
    }

    // Production product: use Produto.leadTimeProducaoDias
    return {
      leadTimeDias: produto.leadTimeProducaoDias ?? 7,
      sigmaLeadTimeDias: 0, // deterministic
    };
  }

  private static readonly MIN_HISTORICAL_LT_OBSERVATIONS = 5;

  /**
   * Get lead time from supplier data (for purchased products).
   * AC-8 (Story 5.7): Prefers computed sigma from HistoricoLeadTime
   * when >= 5 observations exist; falls back to (max-min)/6 estimate.
   */
  private async getSupplierLeadTime(produtoId: string): Promise<LeadTimeData> {
    // Try principal supplier first, then fallback to any supplier
    const supplierLink = await this.prisma.produtoFornecedor.findFirst({
      where: { produtoId },
      orderBy: [
        { isPrincipal: 'desc' },
        { createdAt: 'asc' },
      ],
      select: {
        id: true,
        leadTimeDias: true,
        fornecedor: {
          select: {
            leadTimePadraoDias: true,
            leadTimeMinDias: true,
            leadTimeMaxDias: true,
          },
        },
      },
    });

    if (!supplierLink) {
      this.logger.warn(`No supplier found for product ${produtoId}, using default LT=14 days`);
      return { leadTimeDias: 14, sigmaLeadTimeDias: 0 };
    }

    const ltDias = supplierLink.leadTimeDias
      ?? supplierLink.fornecedor.leadTimePadraoDias
      ?? 14;

    // AC-8 (Story 5.7): Try historical lead time data first
    const historicalSigma = await this.getHistoricalSigmaLt(supplierLink.id);
    if (historicalSigma !== null) {
      this.logger.debug(
        `Product ${produtoId}: Using historical sigma_LT = ${historicalSigma} from lead time records`,
      );
      return { leadTimeDias: ltDias, sigmaLeadTimeDias: historicalSigma };
    }

    // Fallback: sigma_LT = (max - min) / 6 (approximation for normal distribution range)
    const ltMin = supplierLink.fornecedor.leadTimeMinDias;
    const ltMax = supplierLink.fornecedor.leadTimeMaxDias;
    const sigmaLt = (ltMin !== null && ltMax !== null && ltMax > ltMin)
      ? (ltMax - ltMin) / 6
      : 0;

    return {
      leadTimeDias: ltDias,
      sigmaLeadTimeDias: sigmaLt,
    };
  }

  /**
   * Compute sigma_LT from historical lead time records.
   * Returns null if insufficient data (< MIN_HISTORICAL_LT_OBSERVATIONS).
   */
  private async getHistoricalSigmaLt(produtoFornecedorId: string): Promise<number | null> {
    const records = await this.prisma.historicoLeadTime.findMany({
      where: { produtoFornecedorId },
      select: { leadTimeRealDias: true },
    });

    if (records.length < StockParamsService.MIN_HISTORICAL_LT_OBSERVATIONS) {
      return null;
    }

    const values = records.map((r) => r.leadTimeRealDias);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
    return Math.round(Math.sqrt(variance) * 100) / 100;
  }

  /**
   * Check if a product is classified as Class A (ABC classification).
   * Returns null if no classification exists.
   */
  private async getAbcClass(produtoId: string): Promise<'A' | 'B' | 'C' | null> {
    const classification = await this.prisma.skuClassification.findUnique({
      where: { produtoId },
      select: { classeAbc: true },
    });
    return (classification?.classeAbc as 'A' | 'B' | 'C') ?? null;
  }

  /**
   * Fetch raw weekly demand volumes from the last 52 weeks of SerieTemporal data.
   * Returns the raw volume array (for Monte Carlo sampling) and its count.
   */
  private async getDemandHistory(produtoId: string): Promise<readonly number[]> {
    const fiftyTwoWeeksAgo = new Date();
    fiftyTwoWeeksAgo.setDate(
      fiftyTwoWeeksAgo.getDate() - StockParamsService.WEEKS_PER_YEAR * StockParamsService.DAYS_PER_WEEK,
    );

    const series = await this.prisma.serieTemporal.findMany({
      where: {
        produtoId,
        granularidade: 'semanal',
        dataReferencia: { gte: fiftyTwoWeeksAgo },
      },
      select: { volume: true },
      orderBy: { dataReferencia: 'asc' },
    });

    return series.map((s) => Number(s.volume));
  }

  /**
   * Fetch TFT forecast data for a product, covering the lead time horizon.
   * Returns the most recent forecast results ordered by period, limited to
   * leadTimeWeeks entries for the TFT/ENSEMBLE model with VOLUME target.
   */
  private async getTftForecastData(
    produtoId: string,
    leadTimeWeeks: number,
  ): Promise<readonly TftForecastRow[]> {
    if (leadTimeWeeks <= 0) {
      return [];
    }

    // Get the most recent execucaoId that has TFT results for this product
    const latestResult = await this.prisma.forecastResultado.findFirst({
      where: {
        produtoId,
        modeloUsado: 'TFT',
        targetType: 'VOLUME',
      },
      orderBy: { periodo: 'desc' },
      select: { execucaoId: true },
    });

    if (!latestResult) {
      return [];
    }

    const rows = await this.prisma.forecastResultado.findMany({
      where: {
        produtoId,
        execucaoId: latestResult.execucaoId,
        modeloUsado: 'TFT',
        targetType: 'VOLUME',
      },
      orderBy: { periodo: 'asc' },
      take: leadTimeWeeks,
      select: {
        periodo: true,
        p10: true,
        p25: true,
        p50: true,
        p75: true,
        p90: true,
      },
    });

    return rows.map((r) => ({
      periodo: r.periodo,
      p10: r.p10 !== null ? Number(r.p10) : null,
      p25: r.p25 !== null ? Number(r.p25) : null,
      p50: r.p50 !== null ? Number(r.p50) : null,
      p75: r.p75 !== null ? Number(r.p75) : null,
      p90: r.p90 !== null ? Number(r.p90) : null,
    }));
  }

  // ────────────────────────────────────────────────────────────────
  // Internal Helpers
  // ────────────────────────────────────────────────────────────────

  /**
   * Determine the quantile column to use based on service level.
   * Falls back to 'p90' for unknown service levels.
   */
  private getQuantileColumnForServiceLevel(serviceLevel: number): 'p75' | 'p90' {
    const col = StockParamsService.SERVICE_LEVEL_TO_QUANTILE.get(serviceLevel);
    return col ?? 'p90';
  }

  /**
   * Determine if a product type represents a purchased (vs. produced) item.
   */
  private isPurchasedProduct(tipoProduto: string): boolean {
    const purchasedTypes = new Set(['INSUMO', 'MATERIA_PRIMA', 'EMBALAGEM', 'REVENDA']);
    return purchasedTypes.has(tipoProduto);
  }

  /**
   * Round to DECIMAL_PLACES to avoid floating-point precision issues.
   * Uses factor-based rounding for deterministic results.
   */
  private round(value: number, decimals: number = StockParamsService.DECIMAL_PLACES): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  // ────────────────────────────────────────────────────────────────
  // Monte Carlo Helpers (private)
  // ────────────────────────────────────────────────────────────────

  /**
   * Create a seeded pseudo-random number generator using a simple
   * mulberry32 algorithm. Returns Math.random if no seed provided.
   */
  private createSeededRng(seed?: number): () => number {
    if (seed === undefined) {
      return Math.random;
    }
    let s = seed | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Sample from a normal distribution using the Box-Muller transform.
   */
  private sampleNormal(rng: () => number, mean: number, sigma: number): number {
    let u1 = rng();
    // Avoid log(0)
    while (u1 === 0) u1 = rng();
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + sigma * z;
  }

  /**
   * Compute a quantile from a sorted array using linear interpolation.
   */
  private quantile(sorted: readonly number[], p: number): number {
    const n = sorted.length;
    if (n === 0) return 0;
    if (n === 1) return sorted[0];

    const idx = p * (n - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    const frac = idx - lo;

    if (lo === hi) return sorted[lo];
    return sorted[lo] * (1 - frac) + sorted[hi] * frac;
  }

  /**
   * Build histogram buckets from a sorted array of values.
   */
  private buildHistogram(sorted: readonly number[], bucketCount: number): readonly HistogramBucket[] {
    if (sorted.length === 0) return [];

    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    if (min === max) {
      return [{ rangeMin: this.round(min, 2), rangeMax: this.round(max, 2), count: sorted.length }];
    }

    const width = (max - min) / bucketCount;
    const buckets: HistogramBucket[] = [];

    for (let b = 0; b < bucketCount; b++) {
      const rangeMin = min + b * width;
      const rangeMax = b === bucketCount - 1 ? max : min + (b + 1) * width;

      let count = 0;
      for (const val of sorted) {
        if (b === bucketCount - 1) {
          if (val >= rangeMin && val <= rangeMax) count++;
        } else {
          if (val >= rangeMin && val < rangeMax) count++;
        }
      }

      buckets.push({
        rangeMin: this.round(rangeMin, 2),
        rangeMax: this.round(rangeMax, 2),
        count,
      });
    }

    return buckets;
  }
}
