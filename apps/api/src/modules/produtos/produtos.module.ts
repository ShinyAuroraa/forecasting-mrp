import { Module } from '@nestjs/common';
import { ProdutosController } from './produtos.controller';
import { ProdutosService } from './produtos.service';
import { ProdutosRepository } from './produtos.repository';
import { ImportProdutosService } from './import/import-produtos.service';
import { ImportTemplateService } from './import/import-template.service';

@Module({
  controllers: [ProdutosController],
  providers: [ProdutosService, ProdutosRepository, ImportProdutosService, ImportTemplateService],
  exports: [ProdutosService],
})
export class ProdutosModule {}
