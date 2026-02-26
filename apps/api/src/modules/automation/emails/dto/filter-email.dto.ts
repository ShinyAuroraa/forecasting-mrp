import { IsOptional, IsString, IsIn } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

/**
 * DTO for filtering email send history.
 *
 * @see Story 4.7 — AC-18
 */
export class FilterEmailDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @IsIn(['RESUMO_DIARIO', 'BRIEFING_MATINAL'])
  readonly tipo?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ENVIADO', 'FALHA', 'NOOP'])
  readonly status?: string;

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  readonly sortOrder?: string;
}
