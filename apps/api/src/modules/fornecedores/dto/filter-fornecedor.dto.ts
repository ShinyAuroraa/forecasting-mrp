import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FilterFornecedorDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
