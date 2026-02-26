import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class FilterParadaProgramadaDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  centroTrabalhoId?: string;
}
