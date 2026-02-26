import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ClassificacaoService } from './classificacao.service';
import { FilterClassificacaoDto } from './dto/filter-classificacao.dto';
import { UpdateClassificacaoDto } from './dto/update-classificacao.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../common/pipes/uuid-validation.pipe';

@Controller('classificacao')
export class ClassificacaoController {
  constructor(
    private readonly classificacaoService: ClassificacaoService,
  ) {}

  @Get()
  @Roles('viewer')
  findAll(@Query() filters: FilterClassificacaoDto) {
    return this.classificacaoService.findAll(filters);
  }

  @Get(':produtoId')
  @Roles('viewer')
  findOne(@Param('produtoId', UuidValidationPipe) produtoId: string) {
    return this.classificacaoService.findByProdutoId(produtoId);
  }

  @Patch(':produtoId')
  @Roles('operator')
  update(
    @Param('produtoId', UuidValidationPipe) produtoId: string,
    @Body() dto: UpdateClassificacaoDto,
  ) {
    return this.classificacaoService.update(produtoId, dto);
  }

  @Post('recalcular')
  @Roles('operator')
  recalculate() {
    return this.classificacaoService.recalculate();
  }
}
