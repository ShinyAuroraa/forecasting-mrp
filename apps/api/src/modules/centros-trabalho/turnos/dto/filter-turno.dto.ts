import { IsOptional, IsUUID, IsBoolean } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class FilterTurnoDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  centroTrabalhoId?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
