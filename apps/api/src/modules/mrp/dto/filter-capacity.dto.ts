import { IsOptional, IsUUID } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * DTO for filtering capacity load records.
 *
 * Extends PaginationDto with optional filters for execution and work center.
 *
 * @see Story 3.10 — MRP Orchestrator & Execution API
 */
export class FilterCapacityDto extends PaginationDto {
  /** Filter by planning execution ID */
  @IsOptional()
  @IsUUID()
  execucaoId?: string;

  /** Filter by work center ID */
  @IsOptional()
  @IsUUID()
  centroTrabalhoId?: string;
}
