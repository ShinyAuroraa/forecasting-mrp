/**
 * Notification/Alert types for frontend.
 * @see Story 4.4 — Centralized Alert System
 */

export type AlertType =
  | 'STOCKOUT'
  | 'URGENT_PURCHASE'
  | 'CAPACITY_OVERLOAD'
  | 'FORECAST_DEVIATION'
  | 'STORAGE_FULL'
  | 'PIPELINE_FAILURE';

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface Alert {
  readonly id: string;
  readonly tipo: AlertType;
  readonly severidade: AlertSeverity;
  readonly titulo: string;
  readonly mensagem: string;
  readonly entityId?: string;
  readonly entityType?: string;
  readonly metadata: Record<string, unknown>;
  readonly acknowledgedAt: string | null;
  readonly acknowledgedBy: string | null;
  readonly createdAt: string;
}

export interface AlertListResponse {
  readonly data: readonly Alert[];
  readonly total: number;
}

export interface AlertSummary {
  readonly byType: Record<AlertType, number>;
  readonly bySeverity: Record<AlertSeverity, number>;
  readonly totalUnacknowledged: number;
}

export interface AlertQueryParams {
  readonly tipo?: AlertType;
  readonly severidade?: AlertSeverity;
  readonly acknowledged?: boolean;
  readonly since?: string;
  readonly until?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  STOCKOUT: 'Ruptura de Estoque',
  URGENT_PURCHASE: 'Compra Urgente',
  CAPACITY_OVERLOAD: 'Sobrecarga de Capacidade',
  FORECAST_DEVIATION: 'Desvio de Forecast',
  STORAGE_FULL: 'Depósito Cheio',
  PIPELINE_FAILURE: 'Falha no Pipeline',
};

export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  CRITICAL: 'Crítico',
  HIGH: 'Alto',
  MEDIUM: 'Médio',
  LOW: 'Baixo',
  INFO: 'Info',
};

export const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  CRITICAL: 'bg-red-600 text-white',
  HIGH: 'bg-orange-500 text-white',
  MEDIUM: 'bg-yellow-400 text-black',
  LOW: 'bg-blue-400 text-white',
  INFO: 'bg-gray-400 text-white',
};
