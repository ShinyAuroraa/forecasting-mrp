import { IsOptional, IsUUID, IsBoolean } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class FilterRoteiroDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  produtoId?: string;

  @IsOptional()
  @IsUUID()
  centroTrabalhoId?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
