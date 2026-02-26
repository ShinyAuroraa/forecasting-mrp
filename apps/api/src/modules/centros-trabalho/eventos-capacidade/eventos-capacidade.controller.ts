import {
  Controller, Get, Post, Patch,
  Body, Param, Query,
} from '@nestjs/common';
import { EventosCapacidadeService } from './eventos-capacidade.service';
import { CreateEventoCapacidadeDto } from './dto/create-evento-capacidade.dto';
import { UpdateEventoCapacidadeDto } from './dto/update-evento-capacidade.dto';
import { FilterEventoCapacidadeDto } from './dto/filter-evento-capacidade.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../../common/pipes/uuid-validation.pipe';

@Controller('eventos-capacidade')
export class EventosCapacidadeController {
  constructor(private readonly service: EventosCapacidadeService) {}

  @Post()
  @Roles('operator')
  create(@Body() dto: CreateEventoCapacidadeDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles('viewer')
  findAll(@Query() filters: FilterEventoCapacidadeDto) {
    return this.service.findAll(filters);
  }

  @Get(':id')
  @Roles('viewer')
  findOne(@Param('id', UuidValidationPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @Roles('operator')
  update(@Param('id', UuidValidationPipe) id: string, @Body() dto: UpdateEventoCapacidadeDto) {
    return this.service.update(id, dto);
  }
}
