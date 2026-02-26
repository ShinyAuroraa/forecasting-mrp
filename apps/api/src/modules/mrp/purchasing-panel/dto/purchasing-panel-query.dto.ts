import { IsUUID, IsOptional, IsIn } from 'class-validator';

/**
 * Query DTO for fetching purchasing panel data.
 *
 * @see Story 3.11 — Purchasing Panel (AC-1)
 */
export class PurchasingPanelQueryDto {
  @IsUUID()
  execucaoId!: string;
}

/**
 * Query DTO for exporting purchasing panel to Excel.
 *
 * @see Story 3.11 — Purchasing Panel (AC-6)
 */
export class ExportPanelQueryDto {
  @IsUUID()
  execucaoId!: string;

  @IsOptional()
  @IsIn(['xlsx'])
  format?: string = 'xlsx';
}

/**
 * Body DTO for sending purchasing panel email summary.
 *
 * @see Story 3.11 — Purchasing Panel (AC-7)
 */
export class EmailSummaryDto {
  @IsUUID()
  execucaoId!: string;
}
