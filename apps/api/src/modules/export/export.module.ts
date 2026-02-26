import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { ExportProcessor } from './export.processor';
import { ExcelGeneratorService } from './generators/excel.generator';
import { PdfGeneratorService } from './generators/pdf.generator';
import { EXPORT_QUEUE_NAME } from './export.types';

/**
 * ExportModule — Excel/PDF export with async BullMQ support.
 *
 * @see Story 4.10 — FR-058
 */
@Module({
  imports: [
    BullModule.registerQueue({
      name: EXPORT_QUEUE_NAME,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    }),
  ],
  controllers: [ExportController],
  providers: [
    ExportService,
    ExportProcessor,
    ExcelGeneratorService,
    PdfGeneratorService,
  ],
  exports: [ExportService],
})
export class ExportModule {}
