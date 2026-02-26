import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateTurnoDto } from './create-turno.dto';

export class UpdateTurnoDto extends PartialType(
  OmitType(CreateTurnoDto, ['centroTrabalhoId']),
) {}
