import { IsUUID } from 'class-validator';

/**
 * Query DTO for lot sizing comparison endpoint.
 *
 * @see Story 5.1 — AC-11
 */
export class LotSizingCompareDto {
  @IsUUID()
  readonly produtoId!: string;
}
