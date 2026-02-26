import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ExportService } from './export.service';
import { EXPORT_QUEUE_NAME, EXPORT_TYPE_LABELS, type ExportJobData } from './export.types';

/**
 * BullMQ processor for async export jobs.
 *
 * @see Story 4.10 — AC-11, AC-12
 */
@Processor(EXPORT_QUEUE_NAME)
export class ExportProcessor extends WorkerHost {
  private readonly logger = new Logger(ExportProcessor.name);

  constructor(private readonly exportService: ExportService) {
    super();
  }

  async process(job: Job<ExportJobData>): Promise<{ filePath: string; fileName: string; format: string }> {
    const { type, format, filters, userId } = job.data;
    this.logger.log(`Processing export job ${job.id}: ${type} (${format}) for user ${userId}`);

    // Generate file
    const buffer = await this.exportService.generateSync(type, format, filters);

    // Save to temp directory
    const filePath = await this.exportService.saveExportFile(job.id!, buffer, format);

    const label = EXPORT_TYPE_LABELS[type] ?? type;
    const ext = format === 'xlsx' ? 'xlsx' : 'pdf';
    const fileName = `${label.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.${ext}`;

    this.logger.log(`Export job ${job.id} completed: ${filePath}`);

    // AC-12: Notification is handled by the controller polling or SSE
    return { filePath, fileName, format };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ExportJobData>, error: Error): void {
    this.logger.error(`Export job ${job.id} failed: ${error.message}`, error.stack);
  }
}
