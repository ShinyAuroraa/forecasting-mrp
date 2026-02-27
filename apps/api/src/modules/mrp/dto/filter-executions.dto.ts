import { IsOptional, IsEnum } from 'class-validator';

import {
  StatusExecucao,
} from '../../../generated/prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * DTO for filtering MRP execution history.
 *
 * Extends PaginationDto with optional status filter.
 *
 * @see Story 3.10 — MRP Orchestrator & Execution API
 */
export class FilterExecutionsDto extends PaginationDto {
  /** Filter by execution status (PENDENTE, EXECUTANDO, CONCLUIDO, ERRO) */
  @IsOptional()
  @IsEnum(StatusExecucao)
  status?: StatusExecucao;
}
