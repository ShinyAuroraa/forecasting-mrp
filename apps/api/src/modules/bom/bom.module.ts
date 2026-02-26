import { Module } from '@nestjs/common';
import { BomController } from './bom.controller';
import { BomService } from './bom.service';
import { BomRepository } from './bom.repository';
import { BomVersionService } from './bom-version.service';

@Module({
  controllers: [BomController],
  providers: [BomService, BomRepository, BomVersionService],
  exports: [BomService, BomVersionService],
})
export class BomModule {}
