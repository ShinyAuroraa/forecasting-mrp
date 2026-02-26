/**
 * CRP (Capacity Requirements Planning) Interfaces
 *
 * Core data structures for the CRP calculation engine.
 * Used by CrpService to calculate planned load per work center per week,
 * compare against available capacity, determine utilization, and suggest
 * corrective actions for overloaded periods.
 *
 * @see Story 3.9 — CRP & Storage Capacity Validation
 * @see FR-040 — Capacity Requirements Planning
 */

/**
 * Weekly time bucket for CRP calculations.
 * Defines a contiguous period (typically one week) for capacity analysis.
 */
export interface WeeklyBucket {
  /** Start of the period (inclusive), UTC date */
  readonly periodStart: Date;

  /** End of the period (exclusive), UTC date */
  readonly periodEnd: Date;
}

/**
 * Input for the CRP calculation process.
 * Contains the execution context and weekly time buckets to analyze.
 */
export interface CrpInput {
  /** The planning execution identifier — links to OrdemPlanejada records */
  readonly execucaoId: string;

  /** Weekly time buckets to calculate capacity for */
  readonly weeklyBuckets: readonly WeeklyBucket[];
}

/**
 * Capacity result for a single week within a work center.
 * Contains all capacity metrics and the suggested corrective action.
 */
export interface CrpWeekResult {
  /** Start of the period (inclusive), UTC date */
  readonly periodStart: Date;

  /** Available capacity in hours after efficiency and scheduled stops */
  readonly capacidadeDisponivelHoras: number;

  /** Planned load in hours from production orders */
  readonly cargaPlanejadaHoras: number;

  /** Utilization percentage: (planned load / available capacity) * 100 */
  readonly utilizacaoPercentual: number;

  /** Whether utilization exceeds 100% */
  readonly sobrecarga: boolean;

  /** Hours exceeding available capacity (0 if no overload) */
  readonly horasExcedentes: number;

  /** Suggested corrective action based on utilization level */
  readonly sugestao: 'OK' | 'HORA_EXTRA' | 'ANTECIPAR' | 'SUBCONTRATAR' | null;
}

/**
 * CRP results for a single work center across all weekly buckets.
 * Groups weekly capacity analysis by work center.
 */
export interface CrpWorkCenterResult {
  /** Work center database identifier */
  readonly centroTrabalhoId: string;

  /** Work center code (human-readable) */
  readonly codigo: string;

  /** Work center name */
  readonly nome: string;

  /** Weekly capacity results for this work center */
  readonly weeklyCapacity: readonly CrpWeekResult[];
}

/**
 * Output of the CRP calculation process.
 * Contains per-work-center capacity analysis and summary metrics.
 */
export interface CrpOutput {
  /** The planning execution identifier */
  readonly execucaoId: string;

  /** Capacity results per work center */
  readonly workCenters: readonly CrpWorkCenterResult[];

  /** Count of weeks with utilization > 100% across all work centers */
  readonly totalOverloadedWeeks: number;

  /** Non-blocking warnings encountered during calculation */
  readonly warnings: readonly string[];
}
