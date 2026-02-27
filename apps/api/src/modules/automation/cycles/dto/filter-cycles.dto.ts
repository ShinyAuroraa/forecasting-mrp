import { IsOptional, IsIn, IsDateString } from 'class-validator';

import { PaginationDto } from '../../../../common/dto/pagination.dto';
import type { CycleType, CycleStatus } from '../cycle.types';

const ALLOWED_SORT_FIELDS = ['createdAt', 'startedAt', 'completedAt', 'status', 'tipo'] as const;

/**
 * DTO for filtering cycle execution history.
 *
 * @see Story 4.5 — AC-9
 */
export class FilterCyclesDto extends PaginationDto {
  @IsOptional()
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY', 'MANUAL'])
  type?: CycleType;

  @IsOptional()
  @IsIn(['SUCCESS', 'FAILED', 'PARTIAL', 'RUNNING', 'PENDING'])
  status?: CycleStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(ALLOWED_SORT_FIELDS)
  override sortBy?: string;
}
