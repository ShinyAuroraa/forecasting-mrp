import {
  IsUUID,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsOptional,
  IsString,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { TipoParadaProgramada } from '../../../../generated/prisma/client';

export class CreateParadaProgramadaDto {
  @IsUUID()
  @IsNotEmpty()
  centroTrabalhoId!: string;

  @IsEnum(TipoParadaProgramada)
  tipo!: TipoParadaProgramada;

  @IsDateString()
  dataInicio!: string;

  @IsDateString()
  dataFim!: string;

  @IsOptional()
  @IsString()
  motivo?: string;

  @IsOptional()
  @IsBoolean()
  recorrente?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cronExpression?: string;
}
