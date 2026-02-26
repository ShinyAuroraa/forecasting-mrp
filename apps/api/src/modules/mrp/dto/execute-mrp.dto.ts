import { IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';

/**
 * DTO for triggering an MRP execution run.
 *
 * All parameters are optional — system defaults are loaded from ConfigSistema
 * when not provided.
 *
 * @see Story 3.10 — MRP Orchestrator & Execution API
 */
export class ExecuteMrpDto {
  /** Planning horizon in weeks (1-52). Default: 13 (loaded from ConfigSistema) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  planningHorizonWeeks?: number;

  /** Firm-order horizon in weeks (1-12). Default: 2 (loaded from ConfigSistema) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  firmOrderHorizonWeeks?: number;

  /** Force recalculation of stock parameters even if recent results exist */
  @IsOptional()
  @IsBoolean()
  forceRecalculate?: boolean;
}
