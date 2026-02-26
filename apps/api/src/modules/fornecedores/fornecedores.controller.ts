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
import { FornecedoresService } from './fornecedores.service';
import { CreateFornecedorDto } from './dto/create-fornecedor.dto';
import { UpdateFornecedorDto } from './dto/update-fornecedor.dto';
import { FilterFornecedorDto } from './dto/filter-fornecedor.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../common/pipes/uuid-validation.pipe';

@Controller('fornecedores')
export class FornecedoresController {
  constructor(private readonly fornecedoresService: FornecedoresService) {}

  @Post()
  @Roles('operator')
  create(@Body() dto: CreateFornecedorDto) {
    return this.fornecedoresService.create(dto);
  }

  @Get()
  @Roles('viewer')
  findAll(@Query() filters: FilterFornecedorDto) {
    return this.fornecedoresService.findAll(filters);
  }

  @Get(':id')
  @Roles('viewer')
  findOne(@Param('id', UuidValidationPipe) id: string) {
    return this.fornecedoresService.findById(id);
  }

  @Patch(':id')
  @Roles('operator')
  update(
    @Param('id', UuidValidationPipe) id: string,
    @Body() dto: UpdateFornecedorDto,
  ) {
    return this.fornecedoresService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', UuidValidationPipe) id: string) {
    return this.fornecedoresService.remove(id);
  }
}
