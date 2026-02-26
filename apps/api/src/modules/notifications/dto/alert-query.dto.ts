import {
  IsOptional,
  IsIn,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Query DTO for listing alerts with filters.
 * @see Story 4.4 — AC-14
 */
export class AlertQueryDto {
  @IsOptional()
  @IsIn(['STOCKOUT', 'URGENT_PURCHASE', 'CAPACITY_OVERLOAD', 'FORECAST_DEVIATION', 'STORAGE_FULL', 'PIPELINE_FAILURE'])
  tipo?: string;

  @IsOptional()
  @IsIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'])
  severidade?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return value === 'true';
  })
  @IsBoolean()
  acknowledged?: boolean;

  @IsOptional()
  @IsDateString()
  since?: string;

  @IsOptional()
  @IsDateString()
  until?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
