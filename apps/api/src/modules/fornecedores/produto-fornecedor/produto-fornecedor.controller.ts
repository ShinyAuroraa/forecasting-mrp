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
import { ProdutoFornecedorService } from './produto-fornecedor.service';
import { CreateProdutoFornecedorDto } from './dto/create-produto-fornecedor.dto';
import { UpdateProdutoFornecedorDto } from './dto/update-produto-fornecedor.dto';
import { FilterProdutoFornecedorDto } from './dto/filter-produto-fornecedor.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../../common/pipes/uuid-validation.pipe';

@Controller('produto-fornecedor')
export class ProdutoFornecedorController {
  constructor(
    private readonly produtoFornecedorService: ProdutoFornecedorService,
  ) {}

  @Post()
  @Roles('operator')
  create(@Body() dto: CreateProdutoFornecedorDto) {
    return this.produtoFornecedorService.create(dto);
  }

  @Get()
  @Roles('viewer')
  findAll(@Query() filters: FilterProdutoFornecedorDto) {
    return this.produtoFornecedorService.findAll(filters);
  }

  @Get(':id')
  @Roles('viewer')
  findOne(@Param('id', UuidValidationPipe) id: string) {
    return this.produtoFornecedorService.findById(id);
  }

  @Patch(':id')
  @Roles('operator')
  update(
    @Param('id', UuidValidationPipe) id: string,
    @Body() dto: UpdateProdutoFornecedorDto,
  ) {
    return this.produtoFornecedorService.update(id, dto);
  }

  @Delete(':id')
  @Roles('operator')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', UuidValidationPipe) id: string) {
    return this.produtoFornecedorService.remove(id);
  }
}
