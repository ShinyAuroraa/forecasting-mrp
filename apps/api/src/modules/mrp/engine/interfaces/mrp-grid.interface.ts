/**
 * MRP Grid Interfaces
 *
 * Core data structures for the Net Requirement Calculation Engine.
 * Used by NetRequirementService (pure calculation) and consumed by
 * downstream MRP stages (lot-sizing, capacity planning).
 *
 * @see Story 3.2 — Net Requirement Calculation Engine
 * @see FR-049 — Net Requirement Formula
 */

/**
 * A single time-phased bucket within the MRP grid.
 * Each bucket represents one planning period (typically a week).
 */
export interface MrpPeriodBucket {
  /** Start date of the planning period (inclusive) */
  readonly periodStart: Date;

  /** End date of the planning period (inclusive) */
  readonly periodEnd: Date;

  /** Gross requirement for this period (from MPS or BOM explosion) */
  readonly grossRequirement: number;

  /** Scheduled receipts: orders with status FIRME or LIBERADA arriving in this period */
  readonly scheduledReceipts: number;

  /** Projected available stock at the end of this period */
  readonly projectedStock: number;

  /** Net requirement for this period (floored to 0) */
  readonly netRequirement: number;

  /**
   * Planned order receipts for this period.
   * Always 0 at the net-requirement stage — filled later by lot-sizing (Story 3.5).
   */
  readonly plannedOrderReceipts: number;
}

/**
 * An MRP grid row for a single product (SKU).
 * Contains the time-phased array of period buckets.
 */
export interface MrpGridRow {
  /** The product identifier */
  readonly produtoId: string;

  /** Time-phased array of period buckets */
  readonly periods: readonly MrpPeriodBucket[];
}

/**
 * Input for a single period within the net requirement calculation.
 * Provides the demand and supply data needed to compute the period bucket.
 */
export interface NetRequirementPeriodInput {
  /** Start date of the planning period (inclusive) */
  readonly periodStart: Date;

  /** End date of the planning period (inclusive) */
  readonly periodEnd: Date;

  /** Gross requirement for this period */
  readonly grossRequirement: number;

  /** Scheduled receipts arriving in this period */
  readonly scheduledReceipts: number;
}

/**
 * Complete input for the net requirement calculation of a single SKU.
 * The caller is responsible for preparing all data (stock, receipts, demand)
 * before passing to NetRequirementService.calculateNetRequirements().
 */
export interface NetRequirementInput {
  /** The product identifier */
  readonly produtoId: string;

  /** Available stock at the start of the planning horizon (quantidadeDisponivel - quantidadeReservada) */
  readonly initialStock: number;

  /** Safety stock level — acts as lower bound for projected stock */
  readonly safetyStock: number;

  /** Array of planning periods with demand and supply data */
  readonly periods: readonly NetRequirementPeriodInput[];
}
