import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateParadaProgramadaDto } from './create-parada-programada.dto';

export class UpdateParadaProgramadaDto extends PartialType(
  OmitType(CreateParadaProgramadaDto, ['centroTrabalhoId']),
) {}
