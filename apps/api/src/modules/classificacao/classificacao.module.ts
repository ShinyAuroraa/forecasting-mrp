import { Module } from '@nestjs/common';
import { ClassificacaoController } from './classificacao.controller';
import { ClassificacaoService } from './classificacao.service';
import { ClassificacaoRepository } from './classificacao.repository';

@Module({
  controllers: [ClassificacaoController],
  providers: [ClassificacaoService, ClassificacaoRepository],
  exports: [ClassificacaoService],
})
export class ClassificacaoModule {}
