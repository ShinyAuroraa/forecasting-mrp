/**
 * Master Production Schedule (MPS) Interfaces
 *
 * Core data structures for the MPS generation engine.
 * MPS sits at the top of the MRP hierarchy: it produces level-0
 * demand (weekly buckets per finished product) consumed by
 * BOM explosion and downstream net-requirement calculation.
 *
 * Demand rule:
 *   Within firm-order horizon: demand = MAX(forecast_P50, firm_orders)
 *   Beyond firm-order horizon: demand = forecast_P50 only
 *
 * @see Story 3.6 — Master Production Schedule
 * @see FR-034 — MPS Generation
 */

/**
 * Input parameters for MPS generation.
 * All fields are optional — defaults are loaded from ConfigSistema.
 */
export interface MpsInput {
  /** Planning horizon in weeks (default 13) */
  readonly planningHorizonWeeks: number;

  /** Firm-order horizon in weeks (default from ConfigSistema, 2-4) */
  readonly firmOrderHorizonWeeks: number;

  /** Planning start date — aligned to Monday */
  readonly startDate: Date;
}

/**
 * A single weekly demand bucket within the MPS grid.
 * Each bucket spans Monday through Sunday (UTC).
 */
export interface MpsDemandBucket {
  /** Start of the weekly period (Monday, 00:00 UTC) */
  readonly periodStart: Date;

  /** End of the weekly period (Sunday, 23:59:59.999 UTC) */
  readonly periodEnd: Date;

  /** Forecast demand (P50) for this period */
  readonly forecastDemand: number;

  /** Total firm-order demand for this period */
  readonly firmOrderDemand: number;

  /**
   * Final MPS demand for this period.
   * Within firm-order horizon: MAX(forecastDemand, firmOrderDemand)
   * Beyond firm-order horizon: forecastDemand only
   */
  readonly mpsDemand: number;
}

/**
 * MPS result for a single finished product (tipoProduto = ACABADO).
 * Contains the time-phased demand array and any warnings.
 */
export interface MpsProductResult {
  /** Product identifier */
  readonly produtoId: string;

  /** Product code */
  readonly codigo: string;

  /** Product description */
  readonly descricao: string;

  /** Time-phased weekly demand buckets */
  readonly demandBuckets: readonly MpsDemandBucket[];

  /** Warnings generated during MPS calculation (e.g., missing forecast) */
  readonly warnings: readonly string[];
}

/**
 * Complete MPS output — map of all finished products with their
 * time-phased demand. Used as level-0 input for BOM explosion.
 */
export interface MpsOutput {
  /** Timestamp when MPS was generated */
  readonly generatedAt: Date;

  /** Planning horizon used (weeks) */
  readonly planningHorizonWeeks: number;

  /** Firm-order horizon used (weeks) */
  readonly firmOrderHorizonWeeks: number;

  /** Map of produtoId to MPS result per product */
  readonly products: ReadonlyMap<string, MpsProductResult>;

  /** Number of finished products processed */
  readonly totalProductsProcessed: number;

  /** Sum of all mpsDemand values across all products and periods */
  readonly totalDemandPlanned: number;
}
