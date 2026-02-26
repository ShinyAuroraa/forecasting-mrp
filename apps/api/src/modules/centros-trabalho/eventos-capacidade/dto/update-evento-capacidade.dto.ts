import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateEventoCapacidadeDto } from './create-evento-capacidade.dto';

export class UpdateEventoCapacidadeDto extends PartialType(
  OmitType(CreateEventoCapacidadeDto, ['centroTrabalhoId']),
) {}
