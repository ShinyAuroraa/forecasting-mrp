import { Module } from '@nestjs/common';
import { DepositosController } from './depositos/depositos.controller';
import { DepositosService } from './depositos/depositos.service';
import { DepositosRepository } from './depositos/depositos.repository';
import { InventarioAtualController } from './inventario-atual/inventario-atual.controller';
import { InventarioAtualService } from './inventario-atual/inventario-atual.service';
import { InventarioAtualRepository } from './inventario-atual/inventario-atual.repository';

@Module({
  controllers: [DepositosController, InventarioAtualController],
  providers: [
    DepositosService,
    DepositosRepository,
    InventarioAtualService,
    InventarioAtualRepository,
  ],
  exports: [DepositosService, InventarioAtualService],
})
export class InventarioModule {}
