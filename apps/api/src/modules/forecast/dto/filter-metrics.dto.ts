import { IsOptional, IsString, IsUUID, IsBoolean } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FilterMetricsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  executionId?: string;

  @IsOptional()
  @IsString()
  produtoId?: string;

  @IsOptional()
  @IsString()
  classeAbc?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsBoolean()
  isBaseline?: boolean;
}
