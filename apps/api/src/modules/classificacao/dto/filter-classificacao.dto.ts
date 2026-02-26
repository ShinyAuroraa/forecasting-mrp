import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ClasseABC, ClasseXYZ, PadraoDemanda } from '../../../generated/prisma/client';

export class FilterClassificacaoDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ClasseABC)
  classeAbc?: ClasseABC;

  @IsOptional()
  @IsEnum(ClasseXYZ)
  classeXyz?: ClasseXYZ;

  @IsOptional()
  @IsEnum(PadraoDemanda)
  padraoDemanda?: PadraoDemanda;

  @IsOptional()
  @IsString()
  search?: string;
}
