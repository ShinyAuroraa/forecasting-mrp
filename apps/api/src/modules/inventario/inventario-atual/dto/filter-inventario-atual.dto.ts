import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { FonteAtualizacao } from '../../../../generated/prisma/client';

export class FilterInventarioAtualDto extends PaginationDto {
  @IsOptional()
  @IsString()
  produtoId?: string;

  @IsOptional()
  @IsString()
  depositoId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(FonteAtualizacao)
  fonteAtualizacao?: FonteAtualizacao;
}
