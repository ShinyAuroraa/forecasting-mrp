/**
 * Export types for Excel/PDF export functionality.
 *
 * @see Story 4.10 — FR-058
 */

export type ExportType =
  | 'MRP_ORDERS'
  | 'PURCHASING_PANEL'
  | 'FORECAST_DATA'
  | 'CAPACITY'
  | 'STOCK_PARAMS'
  | 'EXECUTIVE_DASHBOARD'
  | 'MRP_SUMMARY'
  | 'FORECAST_ACCURACY'
  | 'SUPPLIER_PERFORMANCE'
  | 'INVENTORY_TURNOVER';

export type ExportFormat = 'xlsx' | 'pdf';

export type ExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ExportJobData {
  readonly type: ExportType;
  readonly format: ExportFormat;
  readonly filters: Record<string, unknown>;
  readonly userId: string;
}

export interface ExportJobResult {
  readonly jobId: string;
  readonly type: ExportType;
  readonly format: ExportFormat;
  readonly status: ExportStatus;
  readonly fileName: string;
  readonly createdAt: string;
  readonly completedAt?: string;
  readonly downloadUrl?: string;
  readonly error?: string;
}

export const EXPORT_QUEUE_NAME = 'export';

/** Threshold for async export — AC-11: >1000 rows */
export const ASYNC_THRESHOLD = 1000;

/** Temp file retention — AC-13: 24h auto-cleanup */
export const FILE_RETENTION_MS = 24 * 60 * 60 * 1000;

export const EXPORT_CONTENT_TYPES: Record<ExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

export const EXPORT_TYPE_LABELS: Record<ExportType, string> = {
  MRP_ORDERS: 'Ordens Planejadas MRP',
  PURCHASING_PANEL: 'Painel de Compras',
  FORECAST_DATA: 'Dados de Forecast',
  CAPACITY: 'Utilização de Capacidade',
  STOCK_PARAMS: 'Parâmetros de Estoque',
  EXECUTIVE_DASHBOARD: 'Dashboard Executivo',
  MRP_SUMMARY: 'Resumo MRP',
  FORECAST_ACCURACY: 'Acurácia de Forecast',
  SUPPLIER_PERFORMANCE: 'Performance de Fornecedores',
  INVENTORY_TURNOVER: 'Giro de Estoque',
};
