import { IsIn, IsOptional, IsObject } from 'class-validator';
import type { ExportType } from '../export.types';

const VALID_TYPES: ExportType[] = [
  'MRP_ORDERS',
  'PURCHASING_PANEL',
  'FORECAST_DATA',
  'CAPACITY',
  'STOCK_PARAMS',
  'EXECUTIVE_DASHBOARD',
  'MRP_SUMMARY',
];

/**
 * DTO for requesting an export.
 *
 * @see Story 4.10 — AC-14, AC-15
 */
export class RequestExportDto {
  @IsIn(VALID_TYPES)
  readonly type!: ExportType;

  @IsOptional()
  @IsObject()
  readonly filters?: Record<string, unknown>;
}
