import { Module } from '@nestjs/common';
import { ErpImportController } from './erp-import.controller';
import { ErpImportService } from './erp-import.service';

@Module({
  controllers: [ErpImportController],
  providers: [ErpImportService],
  exports: [ErpImportService],
})
export class ErpImportModule {}
