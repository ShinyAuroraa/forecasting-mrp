import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TurnosService } from './turnos.service';
import { CreateTurnoDto } from './dto/create-turno.dto';
import { UpdateTurnoDto } from './dto/update-turno.dto';
import { FilterTurnoDto } from './dto/filter-turno.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../../common/pipes/uuid-validation.pipe';

@Controller('turnos')
export class TurnosController {
  constructor(private readonly turnosService: TurnosService) {}

  @Post()
  @Roles('operator')
  create(@Body() dto: CreateTurnoDto) {
    return this.turnosService.create(dto);
  }

  @Get()
  @Roles('viewer')
  findAll(@Query() filters: FilterTurnoDto) {
    return this.turnosService.findAll(filters);
  }

  @Get(':id')
  @Roles('viewer')
  findOne(@Param('id', UuidValidationPipe) id: string) {
    return this.turnosService.findById(id);
  }

  @Patch(':id')
  @Roles('operator')
  update(
    @Param('id', UuidValidationPipe) id: string,
    @Body() dto: UpdateTurnoDto,
  ) {
    return this.turnosService.update(id, dto);
  }

  @Delete(':id')
  @Roles('operator')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', UuidValidationPipe) id: string) {
    return this.turnosService.remove(id);
  }
}
