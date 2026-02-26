import {
  IsUUID,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TipoEventoCapacidade } from '../../../../generated/prisma/client';

export class CreateEventoCapacidadeDto {
  @IsUUID()
  @IsNotEmpty()
  centroTrabalhoId!: string;

  @IsEnum(TipoEventoCapacidade)
  tipo!: TipoEventoCapacidade;

  @IsDateString()
  dataEvento!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  campoAlterado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  valorAnterior?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  valorNovo?: string;

  @IsOptional()
  @IsString()
  motivo?: string;

  @IsOptional()
  @IsDateString()
  previsaoResolucao?: string;

  @IsOptional()
  @IsUUID()
  usuarioId?: string;
}
