import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsEnum,
  IsNumber,
  IsInt,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { TipoCentroTrabalho } from '../../../generated/prisma/client';

export class CreateCentroTrabalhoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  codigo!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome!: string;

  @IsEnum(TipoCentroTrabalho)
  tipo!: TipoCentroTrabalho;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  capacidadeHoraUnidades?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  numOperadores?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  eficienciaPercentual?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tempoSetupMinutos?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  custoHora?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
