import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ParadasProgramadasService } from './paradas-programadas.service';
import { CreateParadaProgramadaDto } from './dto/create-parada-programada.dto';
import { UpdateParadaProgramadaDto } from './dto/update-parada-programada.dto';
import { FilterParadaProgramadaDto } from './dto/filter-parada-programada.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../../common/pipes/uuid-validation.pipe';

@Controller('paradas-programadas')
export class ParadasProgramadasController {
  constructor(private readonly service: ParadasProgramadasService) {}

  @Post()
  @Roles('operator')
  create(@Body() dto: CreateParadaProgramadaDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles('viewer')
  findAll(@Query() filters: FilterParadaProgramadaDto) {
    return this.service.findAll(filters);
  }

  @Get(':id')
  @Roles('viewer')
  findOne(@Param('id', UuidValidationPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @Roles('operator')
  update(@Param('id', UuidValidationPipe) id: string, @Body() dto: UpdateParadaProgramadaDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('operator')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', UuidValidationPipe) id: string) {
    return this.service.remove(id);
  }
}
