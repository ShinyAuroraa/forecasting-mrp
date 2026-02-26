import { IsOptional, IsIn, IsDateString } from 'class-validator';

import { PaginationDto } from '../../../../common/dto/pagination.dto';
import type { PipelineStatus } from '../pipeline.types';

const ALLOWED_SORT_FIELDS = ['createdAt', 'startedAt', 'completedAt', 'status'] as const;

/**
 * DTO for filtering pipeline execution history.
 *
 * @see Story 4.6 — AC-22
 */
export class FilterPipelineDto extends PaginationDto {
  @IsOptional()
  @IsIn(['PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED'])
  status?: PipelineStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(ALLOWED_SORT_FIELDS)
  override sortBy: string = 'createdAt';
}
