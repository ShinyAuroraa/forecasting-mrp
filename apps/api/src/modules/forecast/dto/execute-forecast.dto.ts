import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  IsBoolean,
  IsIn,
  Min,
  Max,
} from 'class-validator';

export class ExecuteForecastDto {
  @IsString()
  @IsIn(['train_model', 'run_forecast', 'run_backtest'])
  jobType!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  produtoIds?: string[];

  @IsOptional()
  @IsString()
  modelo?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  horizonteSemanas?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  holdoutWeeks?: number;

  @IsOptional()
  @IsBoolean()
  forceRetrain?: boolean;
}
