import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';

export enum CategoriaOverrideDto {
  SEASONAL = 'SEASONAL',
  PROMOTION = 'PROMOTION',
  SUPPLY_DISRUPTION = 'SUPPLY_DISRUPTION',
  MARKET_INTELLIGENCE = 'MARKET_INTELLIGENCE',
  OTHER = 'OTHER',
}

export class CreateOverrideDto {
  @IsOptional()
  @IsString()
  forecastResultadoId?: string;

  @IsString()
  @IsNotEmpty()
  produtoId!: string;

  @IsDateString()
  periodo!: string;

  @IsOptional()
  @IsNumber()
  originalP50?: number;

  @IsNumber()
  @Min(0)
  overrideP50!: number;

  @IsString()
  @IsNotEmpty()
  motivo!: string;

  @IsEnum(CategoriaOverrideDto)
  categoriaOverride!: CategoriaOverrideDto;
}
