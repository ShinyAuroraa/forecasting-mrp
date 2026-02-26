import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { TipoCentroTrabalho } from '../../../generated/prisma/client';

export class FilterCentroTrabalhoDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(TipoCentroTrabalho)
  tipo?: TipoCentroTrabalho;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
