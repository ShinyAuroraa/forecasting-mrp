import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { CategoriaOverrideDto } from './create-override.dto';

export class FilterOverridesDto extends PaginationDto {
  @IsOptional()
  @IsString()
  produtoId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsEnum(CategoriaOverrideDto)
  categoriaOverride?: CategoriaOverrideDto;
}
