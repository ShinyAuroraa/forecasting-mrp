import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ExcelGeneratorService } from './generators/excel.generator';
import { PdfGeneratorService } from './generators/pdf.generator';
import {
  EXPORT_QUEUE_NAME,
  ASYNC_THRESHOLD,
  FILE_RETENTION_MS,
  type ExportType,
  type ExportFormat,
  type ExportJobData,
  type ExportJobResult,
} from './export.types';

/**
 * ExportService — orchestrates sync/async file exports.
 *
 * Small exports (<= ASYNC_THRESHOLD rows) return buffers directly.
 * Large exports (> ASYNC_THRESHOLD) run via BullMQ and notify on completion.
 *
 * @see Story 4.10 — AC-11 to AC-17
 */
@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);
  private readonly tmpDir = path.join(os.tmpdir(), 'forecasting-mrp-exports');

  constructor(
    @InjectQueue(EXPORT_QUEUE_NAME) private readonly exportQueue: Queue,
    private readonly excelGenerator: ExcelGeneratorService,
    private readonly pdfGenerator: PdfGeneratorService,
  ) {}

  // ── Sync Export ────────────────────────────────────────

  async generateSync(
    type: ExportType,
    format: ExportFormat,
    filters: Record<string, unknown>,
  ): Promise<Buffer> {
    if (format === 'xlsx') {
      return this.excelGenerator.generate(type, filters);
    }
    return this.pdfGenerator.generate(type, filters);
  }

  // ── Async Export Decision (AC-11) ─────────────────────

  async requestExport(
    type: ExportType,
    format: ExportFormat,
    filters: Record<string, unknown>,
    userId: string,
  ): Promise<{ sync: true; buffer: Buffer } | { sync: false; jobId: string }> {
    // Check row count for async threshold
    const rowCount = format === 'xlsx'
      ? await this.excelGenerator.countRows(type, filters)
      : 0;

    if (rowCount > ASYNC_THRESHOLD) {
      // AC-11: Large export → async via BullMQ
      const jobData: ExportJobData = { type, format, filters, userId };
      const job = await this.exportQueue.add('generate-export', jobData, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      });

      return { sync: false, jobId: job.id! };
    }

    // Small export → sync
    const buffer = await this.generateSync(type, format, filters);
    return { sync: true, buffer };
  }

  // ── File Management (AC-13, AC-16) ────────────────────

  async saveExportFile(jobId: string, buffer: Buffer, format: ExportFormat): Promise<string> {
    await fs.mkdir(this.tmpDir, { recursive: true });
    const ext = format === 'xlsx' ? 'xlsx' : 'pdf';
    const filePath = path.join(this.tmpDir, `export-${jobId}.${ext}`);
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  async getDownloadFile(jobId: string): Promise<{ buffer: Buffer; fileName: string; format: ExportFormat }> {
    const job = await this.exportQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Export job ${jobId} not found`);
    }

    const result = job.returnvalue as { filePath: string; fileName: string; format: ExportFormat } | null;
    if (!result?.filePath) {
      throw new NotFoundException(`Export file for job ${jobId} not ready`);
    }

    try {
      const buffer = await fs.readFile(result.filePath);
      return { buffer, fileName: result.fileName, format: result.format };
    } catch {
      throw new NotFoundException(`Export file for job ${jobId} has expired or was deleted`);
    }
  }

  // ── History (AC-17) ───────────────────────────────────

  async getHistory(userId?: string, limit = 20): Promise<ExportJobResult[]> {
    const [completed, failed] = await Promise.all([
      this.exportQueue.getCompleted(0, limit),
      this.exportQueue.getFailed(0, 5),
    ]);

    const results: ExportJobResult[] = [];

    for (const job of completed) {
      const data = job.data as ExportJobData;
      const result = job.returnvalue as { fileName: string } | null;
      results.push({
        jobId: job.id!,
        type: data.type,
        format: data.format,
        status: 'COMPLETED',
        fileName: result?.fileName ?? `export.${data.format}`,
        createdAt: new Date(job.timestamp).toISOString(),
        completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
        downloadUrl: `/export/${job.id}/download`,
      });
    }

    for (const job of failed) {
      const data = job.data as ExportJobData;
      results.push({
        jobId: job.id!,
        type: data.type,
        format: data.format,
        status: 'FAILED',
        fileName: `export.${data.format}`,
        createdAt: new Date(job.timestamp).toISOString(),
        error: job.failedReason ?? 'Unknown error',
      });
    }

    // Filter by userId if provided (HIGH-4: user-scoped history)
    const filtered = userId
      ? results.filter((r) => {
          const job = [...completed, ...failed].find((j) => j.id === r.jobId);
          return (job?.data as ExportJobData)?.userId === userId;
        })
      : results;

    // Sort by creation date descending
    return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ── Cleanup (AC-13) ──────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredFiles(): Promise<number> {
    try {
      const files = await fs.readdir(this.tmpDir);
      const cutoff = Date.now() - FILE_RETENTION_MS;
      let deleted = 0;

      for (const file of files) {
        const filePath = path.join(this.tmpDir, file);
        const stat = await fs.stat(filePath);
        if (stat.mtimeMs < cutoff) {
          await fs.unlink(filePath);
          deleted++;
        }
      }

      if (deleted > 0) {
        this.logger.log(`Cleaned up ${deleted} expired export files`);
      }
      return deleted;
    } catch {
      return 0;
    }
  }
}
