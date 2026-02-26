import { IsOptional, IsString, IsEnum, IsUUID, IsBoolean } from 'class-validator';
import { TipoProduto } from '../../../generated/prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FilterProdutoDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(TipoProduto)
  tipoProduto?: TipoProduto;

  @IsOptional()
  @IsUUID()
  categoriaId?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
