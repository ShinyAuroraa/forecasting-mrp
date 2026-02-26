import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { TipoDeposito } from '../../../../generated/prisma/client';

export class CreateDepositoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  codigo!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome!: string;

  @IsEnum(TipoDeposito)
  tipo!: TipoDeposito;

  @IsOptional()
  @IsNumber()
  @Min(0)
  capacidadeM3?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacidadePosicoes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  capacidadeKg?: number;

  @IsOptional()
  @IsNumber()
  temperaturaMin?: number;

  @IsOptional()
  @IsNumber()
  temperaturaMax?: number;

  @IsOptional()
  @IsString()
  endereco?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
