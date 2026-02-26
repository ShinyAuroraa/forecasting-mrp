/**
 * Storage Validation Interfaces
 *
 * Core data structures for the Storage Validation engine.
 * Used by StorageValidationService to project inventory volume per warehouse
 * per week, compare against warehouse capacity, and generate severity-based
 * alerts when utilization exceeds defined thresholds.
 *
 * @see Story 3.9 — CRP & Storage Capacity Validation
 * @see FR-041 — Storage Capacity Validation
 */

/**
 * Severity levels for storage utilization alerts.
 *
 * Thresholds (AC-10):
 *   - OK: utilization <= 90%
 *   - ALERT: 90% < utilization <= 95%
 *   - CRITICAL: utilization > 95%
 */
export type StorageAlertSeverity = 'OK' | 'ALERT' | 'CRITICAL';

/**
 * A planned material movement (receipt or requirement) used for volume projection.
 */
export interface PlannedMovement {
  /** The product identifier */
  readonly produtoId: string;

  /** Quantity of the movement (positive) */
  readonly quantity: number;

  /** Date of the planned movement */
  readonly date: Date;
}

/**
 * Input for the storage validation process.
 * Contains weekly time buckets and planned material movements.
 */
export interface StorageValidationInput {
  /** Weekly time buckets to validate storage for */
  readonly weeklyBuckets: readonly { periodStart: Date; periodEnd: Date }[];

  /** Planned receipts (incoming material — increases inventory) */
  readonly plannedReceipts: readonly PlannedMovement[];

  /** Gross requirements (outgoing material — decreases inventory) */
  readonly grossRequirements: readonly PlannedMovement[];
}

/**
 * Storage validation result for a single week within a deposito.
 * Contains projected volume, capacity, utilization, and severity.
 */
export interface StorageWeekResult {
  /** Start of the period (inclusive), UTC date */
  readonly periodStart: Date;

  /** Projected inventory volume in cubic meters */
  readonly projectedVolumeM3: number;

  /** Warehouse capacity in cubic meters */
  readonly capacityM3: number;

  /** Utilization percentage: (projected volume / capacity) * 100 */
  readonly utilizationPercentual: number;

  /** Alert severity based on utilization thresholds */
  readonly severity: StorageAlertSeverity;
}

/**
 * Storage validation results for a single deposito across all weekly buckets.
 * Groups weekly projections by warehouse.
 */
export interface StorageDepositoResult {
  /** Deposito database identifier (AC-11) */
  readonly depositoId: string;

  /** Deposito code (human-readable) */
  readonly codigo: string;

  /** Deposito name */
  readonly nome: string;

  /** Weekly storage results for this deposito */
  readonly weeklyResults: readonly StorageWeekResult[];

  /** Whether any week has ALERT severity */
  readonly hasAlert: boolean;

  /** Whether any week has CRITICAL severity */
  readonly hasCritical: boolean;
}

/**
 * Output of the storage validation process.
 * Contains per-deposito storage projections and alert counts.
 */
export interface StorageValidationOutput {
  /** Storage results per deposito */
  readonly depositos: readonly StorageDepositoResult[];

  /** Total number of ALERT severity weeks across all depositos */
  readonly totalAlerts: number;

  /** Total number of CRITICAL severity weeks across all depositos */
  readonly totalCriticals: number;
}
