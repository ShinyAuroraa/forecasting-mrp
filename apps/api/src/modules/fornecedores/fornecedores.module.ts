import { Module } from '@nestjs/common';
import { FornecedoresController } from './fornecedores.controller';
import { FornecedoresService } from './fornecedores.service';
import { FornecedoresRepository } from './fornecedores.repository';
import { ProdutoFornecedorController } from './produto-fornecedor/produto-fornecedor.controller';
import { ProdutoFornecedorService } from './produto-fornecedor/produto-fornecedor.service';
import { ProdutoFornecedorRepository } from './produto-fornecedor/produto-fornecedor.repository';
import { LeadTimeController } from './lead-time/lead-time.controller';
import { LeadTimeTrackingService } from './lead-time/lead-time-tracking.service';

@Module({
  controllers: [FornecedoresController, ProdutoFornecedorController, LeadTimeController],
  providers: [
    FornecedoresService,
    FornecedoresRepository,
    ProdutoFornecedorService,
    ProdutoFornecedorRepository,
    LeadTimeTrackingService,
  ],
  exports: [FornecedoresService, ProdutoFornecedorService, LeadTimeTrackingService],
})
export class FornecedoresModule {}
