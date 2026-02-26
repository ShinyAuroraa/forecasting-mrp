/**
 * Stock Parameter Calculation Interfaces
 *
 * Core data structures for the Stock Parameter Calculation Engine.
 * Used by StockParamsService to compute safety stock, reorder point,
 * EOQ, min/max levels for a given SKU.
 *
 * @see Story 3.3 — Stock Parameter Calculation
 */

/**
 * Calculation method used for safety stock determination.
 * Maps directly to the MetodoCalculo Prisma enum.
 */
export type StockCalcMethod = 'TFT_QUANTIL' | 'FORMULA_CLASSICA' | 'MONTE_CARLO';

/**
 * Product data required for stock parameter calculation.
 * Fetched from the Produto model.
 */
export interface StockParamsProductData {
  readonly id: string;
  readonly tipoProduto: 'ACABADO' | 'SEMI_ACABADO' | 'INSUMO' | 'EMBALAGEM' | 'MATERIA_PRIMA' | 'REVENDA';
  readonly custoUnitario: number | null;
  readonly custoPedido: number | null;
  readonly custoManutencaoPctAno: number | null;
  readonly intervaloRevisaoDias: number | null;
  readonly estoqueSegurancaManual: number | null;
  readonly leadTimeProducaoDias: number | null;
}

/**
 * Lead time data resolved from ProdutoFornecedor + Fornecedor (COMPRA)
 * or from Produto.leadTimeProducaoDias (PRODUCAO).
 */
export interface LeadTimeData {
  /** Lead time in calendar days */
  readonly leadTimeDias: number;

  /** Standard deviation of lead time in days (0 for production products) */
  readonly sigmaLeadTimeDias: number;
}

/**
 * Demand statistics computed from the last 52 weeks of SerieTemporal data.
 */
export interface DemandStatistics {
  /** Average weekly demand (d_bar) */
  readonly dBarWeekly: number;

  /** Standard deviation of weekly demand (sigma_d) */
  readonly sigmaDWeekly: number;

  /** Annual demand (d_bar * 52) */
  readonly dAnnual: number;
}

/**
 * A single TFT forecast row with quantile columns,
 * fetched from ForecastResultado for a specific product.
 */
export interface TftForecastRow {
  readonly periodo: Date;
  readonly p10: number | null;
  readonly p25: number | null;
  readonly p50: number | null;
  readonly p75: number | null;
  readonly p90: number | null;
}

/**
 * Input for the main calculateForProduct orchestration method.
 */
export interface StockParamsInput {
  readonly produtoId: string;
  readonly execucaoId: string;
  readonly serviceLevel?: number;
}

/**
 * Output from the stock parameter calculation.
 * Matches the ParametrosEstoque model structure.
 */
export interface StockParamsResult {
  readonly id: string;
  readonly execucaoId: string;
  readonly produtoId: string;
  readonly safetyStock: number;
  readonly reorderPoint: number;
  readonly estoqueMinimo: number;
  readonly estoqueMaximo: number;
  readonly eoq: number;
  readonly metodoCalculo: StockCalcMethod;
  readonly nivelServicoUsado: number;
  readonly calculatedAt: Date;
}

/**
 * Input parameters for Monte Carlo safety stock simulation.
 */
export interface MonteCarloInput {
  /** Historical weekly demand values (from SerieTemporal) */
  readonly demandHistory: readonly number[];
  /** Mean lead time in weeks */
  readonly leadTimeMeanWeeks: number;
  /** Standard deviation of lead time in weeks */
  readonly leadTimeSigmaWeeks: number;
  /** Target service level (0-1), e.g. 0.95 */
  readonly serviceLevel: number;
  /** Number of simulation iterations (default 10,000) */
  readonly iterations: number;
  /** Optional seed for reproducible results (testing) */
  readonly seed?: number;
}

/**
 * Result of a Monte Carlo safety stock simulation.
 */
export interface MonteCarloResult {
  /** Calculated safety stock value */
  readonly safetyStock: number;
  /** Number of iterations run */
  readonly iterations: number;
  /** Mean total demand over lead time */
  readonly meanDemandOverLt: number;
  /** Confidence interval */
  readonly confidenceInterval: {
    readonly p5: number;
    readonly p95: number;
  };
  /** Histogram buckets for visualization */
  readonly histogram: readonly HistogramBucket[];
}

/**
 * A single histogram bucket for Monte Carlo result visualization.
 */
export interface HistogramBucket {
  readonly rangeMin: number;
  readonly rangeMax: number;
  readonly count: number;
}
