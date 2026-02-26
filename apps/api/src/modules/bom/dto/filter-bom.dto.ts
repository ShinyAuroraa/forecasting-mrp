import { IsOptional, IsUUID, IsBoolean } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FilterBomDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  produtoPaiId?: string;

  @IsOptional()
  @IsUUID()
  produtoFilhoId?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
