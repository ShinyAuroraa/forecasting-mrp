import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsPositive,
  MaxLength,
  Min,
  IsInt,
} from 'class-validator';
import {
  TipoProduto,
  PoliticaRessuprimento,
} from '../../../generated/prisma/client';

export class CreateProdutoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  codigo!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  descricao!: string;

  @IsEnum(TipoProduto)
  tipoProduto!: TipoProduto;

  @IsOptional()
  @IsUUID()
  categoriaId?: string;

  @IsOptional()
  @IsUUID()
  unidadeMedidaId?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  pesoLiquidoKg?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  volumeM3?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  custoUnitario?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  custoPedido?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  custoManutencaoPctAno?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precoVenda?: number;

  @IsOptional()
  @IsEnum(PoliticaRessuprimento)
  politicaRessuprimento?: PoliticaRessuprimento;

  @IsOptional()
  @IsInt()
  @IsPositive()
  intervaloRevisaoDias?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  loteMinimo?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  multiploCompra?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estoqueSegurancaManual?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeProducaoDias?: number;
}
