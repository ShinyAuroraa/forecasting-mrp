/**
 * Lot Sizing Interfaces
 *
 * Core data structures for the Lot Sizing Engine.
 * Used by LotSizingService (pure calculation) to determine planned order
 * quantities from net requirements using L4L, EOQ, or Silver-Meal methods,
 * apply purchasing constraints, and offset releases by lead time.
 *
 * @see Story 3.5 — Lot Sizing Engine
 * @see FR-037 — Lot Sizing Methods
 */

/**
 * A period with a net requirement quantity.
 * Represents one time bucket in the planning horizon where demand exists.
 */
export interface LotSizingPeriod {
  /** Start date of the planning period (inclusive) */
  readonly periodStart: Date;

  /** End date of the planning period (inclusive) */
  readonly periodEnd: Date;

  /** Net requirement quantity for this period (from NetRequirementService) */
  readonly quantity: number;
}

/**
 * Input for the lot sizing calculation.
 * All data is pre-fetched — this is a pure calculation interface.
 * The caller is responsible for preparing all parameters before
 * passing to LotSizingService.calculateLotSizing().
 */
export interface LotSizingInput {
  /** The product identifier */
  readonly produtoId: string;

  /** Net requirements per period (from NetRequirementService) */
  readonly netRequirements: readonly LotSizingPeriod[];

  /** Lot sizing method */
  readonly method: 'L4L' | 'EOQ' | 'SILVER_MEAL' | 'WAGNER_WHITIN';

  /** Pre-calculated EOQ value (from StockParamsService) — used only when method = EOQ */
  readonly eoqValue: number;

  /** Minimum lot size (from Produto.loteMinimo, default 1) */
  readonly loteMinimo: number;

  /** Purchase multiple (from Produto.multiploCompra, default 1) */
  readonly multiploCompra: number;

  /** Minimum Order Quantity from supplier (from ProdutoFornecedor.moq, default 1) */
  readonly moq: number;

  /** Lead time in weekly periods (for release date offset) */
  readonly leadTimePeriods: number;

  /** Ordering cost K (for Silver-Meal) */
  readonly orderingCost: number;

  /**
   * Holding cost per unit per period h (for Silver-Meal).
   * Calculate as: custoUnitario * custoManutencaoPctAno / 100 / 52
   */
  readonly holdingCostPerUnit: number;
}

/**
 * A planned order entry (receipt or release).
 * Represents a single planned order placed at a specific period.
 */
export interface PlannedOrder {
  /** Index of the period in the netRequirements array */
  readonly periodIndex: number;

  /** Start date of the planning period (inclusive) */
  readonly periodStart: Date;

  /** End date of the planning period (inclusive) */
  readonly periodEnd: Date;

  /** Planned order quantity (after constraint application) */
  readonly quantity: number;
}

/**
 * Output of lot sizing calculation.
 * Contains planned order receipts (in the period of need),
 * planned order releases (offset back by lead time),
 * and any past-due releases that fall before the planning horizon.
 */
export interface LotSizingOutput {
  /** The product identifier */
  readonly produtoId: string;

  /** Planned order receipts — in the period of need */
  readonly plannedOrderReceipts: readonly PlannedOrder[];

  /** Planned order releases — offset back by lead time */
  readonly plannedOrderReleases: readonly PlannedOrder[];

  /** Past-due releases — releases that fall before the planning horizon */
  readonly pastDueReleases: readonly PlannedOrder[];
}
