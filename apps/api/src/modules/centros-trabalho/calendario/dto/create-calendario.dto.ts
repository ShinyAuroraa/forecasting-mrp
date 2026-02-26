import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { TipoCalendarioFabrica } from '../../../../generated/prisma/client';

export class CreateCalendarioDto {
  @IsDateString()
  @IsNotEmpty()
  data!: string;

  @IsEnum(TipoCalendarioFabrica)
  tipo!: TipoCalendarioFabrica;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  descricao?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24)
  horasProdutivas?: number;
}
