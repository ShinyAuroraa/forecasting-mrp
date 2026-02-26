/**
 * Alert System Types
 * @see Story 4.4 — AC-2, AC-3, AC-4
 */

export type AlertType =
  | 'STOCKOUT'
  | 'URGENT_PURCHASE'
  | 'CAPACITY_OVERLOAD'
  | 'FORECAST_DEVIATION'
  | 'STORAGE_FULL'
  | 'PIPELINE_FAILURE';

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface CreateAlertDto {
  readonly tipo: AlertType;
  readonly severidade: AlertSeverity;
  readonly titulo: string;
  readonly mensagem: string;
  readonly entityId?: string;
  readonly entityType?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface AlertSummary {
  readonly byType: Record<AlertType, number>;
  readonly bySeverity: Record<AlertSeverity, number>;
  readonly totalUnacknowledged: number;
}
