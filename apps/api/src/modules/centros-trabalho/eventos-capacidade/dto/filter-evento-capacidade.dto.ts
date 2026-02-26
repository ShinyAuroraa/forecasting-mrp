import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class FilterEventoCapacidadeDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  centroTrabalhoId?: string;
}
