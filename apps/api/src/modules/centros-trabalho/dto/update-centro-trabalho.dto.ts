import { PartialType } from '@nestjs/mapped-types';
import { CreateCentroTrabalhoDto } from './create-centro-trabalho.dto';

export class UpdateCentroTrabalhoDto extends PartialType(CreateCentroTrabalhoDto) {}
