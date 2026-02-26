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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ProdutosService } from './produtos.service';
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { FilterProdutoDto } from './dto/filter-produto.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../common/pipes/uuid-validation.pipe';
import { ImportProdutosService } from './import/import-produtos.service';
import { ImportTemplateService } from './import/import-template.service';

@Controller('produtos')
export class ProdutosController {
  constructor(
    private readonly produtosService: ProdutosService,
    private readonly importService: ImportProdutosService,
    private readonly templateService: ImportTemplateService,
  ) {}

  @Post()
  @Roles('operator')
  create(@Body() dto: CreateProdutoDto) {
    return this.produtosService.create(dto);
  }

  @Get()
  @Roles('viewer')
  findAll(@Query() filters: FilterProdutoDto) {
    return this.produtosService.findAll(filters);
  }

  @Post('import')
  @Roles('operator')
  @UseInterceptors(FileInterceptor('file'))
  async importProducts(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.importService.processImport(file);
  }

  @Get('import/template')
  @Roles('viewer')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.templateService.generateTemplate();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename=produtos-template.xlsx',
    });
    res.send(buffer);
  }

  @Get(':id')
  @Roles('viewer')
  findOne(@Param('id', UuidValidationPipe) id: string) {
    return this.produtosService.findById(id);
  }

  @Patch(':id')
  @Roles('operator')
  update(
    @Param('id', UuidValidationPipe) id: string,
    @Body() dto: UpdateProdutoDto,
  ) {
    return this.produtosService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', UuidValidationPipe) id: string) {
    return this.produtosService.remove(id);
  }
}
