import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { FonteAtualizacao } from '../../../../generated/prisma/client';

export class CreateInventarioAtualDto {
  @IsString()
  @IsNotEmpty()
  produtoId!: string;

  @IsString()
  @IsNotEmpty()
  depositoId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantidadeDisponivel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantidadeReservada?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantidadeEmTransito?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantidadeEmQuarentena?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lote?: string;

  @IsOptional()
  @IsDateString()
  dataValidade?: string;

  @IsOptional()
  @IsDateString()
  dataUltimaContagem?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  custoMedioUnitario?: number;

  @IsOptional()
  @IsEnum(FonteAtualizacao)
  fonteAtualizacao?: FonteAtualizacao;
}
