import { IsOptional, IsEnum, IsString, MaxLength } from 'class-validator';
import { ClasseABC, ClasseXYZ, PadraoDemanda } from '../../../generated/prisma/client';

export class UpdateClassificacaoDto {
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
  @MaxLength(50)
  modeloForecastSugerido?: string;
}
