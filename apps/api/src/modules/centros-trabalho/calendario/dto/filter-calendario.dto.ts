import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { TipoCalendarioFabrica } from '../../../../generated/prisma/client';

export class FilterCalendarioDto extends PaginationDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(TipoCalendarioFabrica)
  tipo?: TipoCalendarioFabrica;
}
