import { IsOptional, IsEnum, IsUUID } from 'class-validator';

import {
  TipoOrdem,
  PrioridadeOrdem,
} from '../../../generated/prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * DTO for filtering planned orders.
 *
 * Extends PaginationDto with optional filters for execution, order type,
 * priority, and product.
 *
 * @see Story 3.10 — MRP Orchestrator & Execution API
 */
export class FilterOrdersDto extends PaginationDto {
  /** Filter by planning execution ID */
  @IsOptional()
  @IsUUID()
  execucaoId?: string;

  /** Filter by order type (COMPRA or PRODUCAO) */
  @IsOptional()
  @IsEnum(TipoOrdem)
  tipo?: TipoOrdem;

  /** Filter by priority (CRITICA, ALTA, MEDIA, BAIXA) */
  @IsOptional()
  @IsEnum(PrioridadeOrdem)
  prioridade?: PrioridadeOrdem;

  /** Filter by product ID */
  @IsOptional()
  @IsUUID()
  produtoId?: string;
}
