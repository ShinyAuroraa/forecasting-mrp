import {
  IsUUID,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsString,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

export class CreateBomDto {
  @IsUUID()
  @IsNotEmpty()
  produtoPaiId!: string;

  @IsUUID()
  @IsNotEmpty()
  produtoFilhoId!: string;

  @IsNumber()
  @Min(0.000001)
  quantidade!: number;

  @IsOptional()
  @IsUUID()
  unidadeMedidaId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  perdaPercentual?: number;

  @IsOptional()
  @IsString()
  observacao?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsDateString()
  validoDesde?: string;

  @IsOptional()
  @IsDateString()
  validoAte?: string;
}
