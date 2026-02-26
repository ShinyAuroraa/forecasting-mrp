import {
  IsUUID,
  IsOptional,
  IsInt,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';

export class CreateProdutoFornecedorDto {
  @IsUUID()
  produtoId!: string;

  @IsUUID()
  fornecedorId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDias?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precoUnitario?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  moq?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  multiploCompra?: number;

  @IsOptional()
  @IsBoolean()
  isPrincipal?: boolean;
}
