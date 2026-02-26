import { IsUUID, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for POST /mrp/stock-params/monte-carlo endpoint.
 *
 * @see Story 5.2 — AC-11
 */
export class MonteCarloSimulationDto {
  @IsUUID()
  readonly produtoId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  readonly serviceLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(100_000)
  @Type(() => Number)
  readonly iterations?: number;
}
