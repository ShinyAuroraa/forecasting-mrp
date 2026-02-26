import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { InventarioAtualService } from './inventario-atual.service';
import { CreateInventarioAtualDto } from './dto/create-inventario-atual.dto';
import { UpdateInventarioAtualDto } from './dto/update-inventario-atual.dto';
import { FilterInventarioAtualDto } from './dto/filter-inventario-atual.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../../common/pipes/uuid-validation.pipe';

@Controller('inventario')
export class InventarioAtualController {
  constructor(
    private readonly inventarioAtualService: InventarioAtualService,
  ) {}

  @Post()
  @Roles('operator')
  create(@Body() dto: CreateInventarioAtualDto) {
    return this.inventarioAtualService.create(dto);
  }

  @Get()
  @Roles('viewer')
  findAll(@Query() filters: FilterInventarioAtualDto) {
    return this.inventarioAtualService.findAll(filters);
  }

  @Get(':id')
  @Roles('viewer')
  findOne(@Param('id', UuidValidationPipe) id: string) {
    return this.inventarioAtualService.findById(id);
  }

  @Patch(':id')
  @Roles('operator')
  update(
    @Param('id', UuidValidationPipe) id: string,
    @Body() dto: UpdateInventarioAtualDto,
  ) {
    return this.inventarioAtualService.update(id, dto);
  }
}
