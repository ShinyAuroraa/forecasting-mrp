import { Module } from '@nestjs/common';
import { ConfigSistemaController } from './config-sistema.controller';
import { ConfigSistemaService } from './config-sistema.service';

@Module({
  controllers: [ConfigSistemaController],
  providers: [ConfigSistemaService],
  exports: [ConfigSistemaService],
})
export class ConfigSistemaModule {}
