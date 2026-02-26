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
import { CentrosTrabalhoService } from './centros-trabalho.service';
import { CreateCentroTrabalhoDto } from './dto/create-centro-trabalho.dto';
import { UpdateCentroTrabalhoDto } from './dto/update-centro-trabalho.dto';
import { FilterCentroTrabalhoDto } from './dto/filter-centro-trabalho.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../common/pipes/uuid-validation.pipe';

@Controller('centros-trabalho')
export class CentrosTrabalhoController {
  constructor(private readonly service: CentrosTrabalhoService) {}

  @Post()
  @Roles('operator')
  create(@Body() dto: CreateCentroTrabalhoDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles('viewer')
  findAll(@Query() filters: FilterCentroTrabalhoDto) {
    return this.service.findAll(filters);
  }

  @Get(':id')
  @Roles('viewer')
  findOne(@Param('id', UuidValidationPipe) id: string) {
    return this.service.findByIdWithCapacity(id);
  }

  @Patch(':id')
  @Roles('operator')
  update(
    @Param('id', UuidValidationPipe) id: string,
    @Body() dto: UpdateCentroTrabalhoDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', UuidValidationPipe) id: string) {
    return this.service.remove(id);
  }
}
