/**
 * Frontend types for Excel/PDF export.
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
  | 'MRP_SUMMARY';

export type ExportFormat = 'xlsx' | 'pdf';

export interface ExportJobResult {
  readonly jobId: string;
  readonly type: ExportType;
  readonly format: ExportFormat;
  readonly status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  readonly fileName: string;
  readonly createdAt: string;
  readonly completedAt?: string;
  readonly downloadUrl?: string;
  readonly error?: string;
}

export interface ExportRequest {
  readonly type: ExportType;
  readonly filters?: Record<string, unknown>;
}

export interface AsyncExportResponse {
  readonly jobId: string;
  readonly message: string;
  readonly downloadUrl: string;
}

export const EXPORT_TYPE_OPTIONS: { value: ExportType; label: string }[] = [
  { value: 'MRP_ORDERS', label: 'Ordens Planejadas MRP' },
  { value: 'PURCHASING_PANEL', label: 'Painel de Compras' },
  { value: 'FORECAST_DATA', label: 'Dados de Forecast' },
  { value: 'CAPACITY', label: 'Utilização de Capacidade' },
  { value: 'STOCK_PARAMS', label: 'Parâmetros de Estoque' },
  { value: 'EXECUTIVE_DASHBOARD', label: 'Dashboard Executivo' },
  { value: 'MRP_SUMMARY', label: 'Resumo MRP' },
];

export const PDF_SUPPORTED_TYPES: ExportType[] = [
  'EXECUTIVE_DASHBOARD',
  'MRP_SUMMARY',
];
