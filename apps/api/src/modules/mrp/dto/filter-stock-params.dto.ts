import { IsOptional, IsUUID } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * DTO for filtering stock parameter records.
 *
 * Extends PaginationDto with optional filters for execution and product.
 *
 * @see Story 3.10 — MRP Orchestrator & Execution API
 */
export class FilterStockParamsDto extends PaginationDto {
  /** Filter by planning execution ID */
  @IsOptional()
  @IsUUID()
  execucaoId?: string;

  /** Filter by product ID */
  @IsOptional()
  @IsUUID()
  produtoId?: string;
}
