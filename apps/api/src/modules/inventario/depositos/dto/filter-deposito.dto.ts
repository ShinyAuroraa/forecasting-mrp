import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { TipoDeposito } from '../../../../generated/prisma/client';

export class FilterDepositoDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(TipoDeposito)
  tipo?: TipoDeposito;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
