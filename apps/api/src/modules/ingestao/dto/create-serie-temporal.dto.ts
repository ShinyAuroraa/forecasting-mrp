import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { Granularidade, FonteAtualizacao } from '../../../generated/prisma/client';

export class CreateSerieTemporalDto {
  @IsString()
  @IsNotEmpty()
  produtoId!: string;

  @IsDateString()
  dataReferencia!: string;

  @IsOptional()
  @IsEnum(Granularidade)
  granularidade?: Granularidade;

  @IsOptional()
  @IsNumber()
  @Min(0)
  volume?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  receita?: number;

  @IsOptional()
  @IsString()
  fonte?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  qualidade?: number;
}
