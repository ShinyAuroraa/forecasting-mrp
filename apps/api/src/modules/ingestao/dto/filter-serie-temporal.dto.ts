import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { Granularidade } from '../../../generated/prisma/client';

export class FilterSerieTemporalDto extends PaginationDto {
  @IsOptional()
  @IsString()
  produtoId?: string;

  @IsOptional()
  @IsEnum(Granularidade)
  granularidade?: Granularidade;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
