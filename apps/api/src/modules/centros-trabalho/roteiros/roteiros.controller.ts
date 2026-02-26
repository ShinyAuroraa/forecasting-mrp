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
import { RoteirosService } from './roteiros.service';
import { CreateRoteiroDto } from './dto/create-roteiro.dto';
import { UpdateRoteiroDto } from './dto/update-roteiro.dto';
import { FilterRoteiroDto } from './dto/filter-roteiro.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../../common/pipes/uuid-validation.pipe';

@Controller('roteiros')
export class RoteirosController {
  constructor(private readonly roteirosService: RoteirosService) {}

  @Post()
  @Roles('operator')
  create(@Body() dto: CreateRoteiroDto) {
    return this.roteirosService.create(dto);
  }

  @Get()
  @Roles('viewer')
  findAll(@Query() filters: FilterRoteiroDto) {
    return this.roteirosService.findAll(filters);
  }

  @Get('produto/:produtoId')
  @Roles('viewer')
  findByProdutoId(
    @Param('produtoId', UuidValidationPipe) produtoId: string,
  ) {
    return this.roteirosService.findByProdutoId(produtoId);
  }

  @Get(':id')
  @Roles('viewer')
  findOne(@Param('id', UuidValidationPipe) id: string) {
    return this.roteirosService.findById(id);
  }

  @Patch(':id')
  @Roles('operator')
  update(
    @Param('id', UuidValidationPipe) id: string,
    @Body() dto: UpdateRoteiroDto,
  ) {
    return this.roteirosService.update(id, dto);
  }

  @Delete(':id')
  @Roles('operator')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', UuidValidationPipe) id: string) {
    return this.roteirosService.remove(id);
  }
}
