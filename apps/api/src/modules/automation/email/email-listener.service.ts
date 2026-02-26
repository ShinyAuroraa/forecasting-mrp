import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IngestaoUploadService } from '../../ingestao/ingestao-upload.service';
import { PdfOcrService } from '../ocr/pdf-ocr.service';
import { EmailAdapterFactory } from './email-adapter.factory';
import type {
  EmailListenerConfig,
  EmailMessage,
  EmailAttachment,
} from './email-adapter.interface';

const EMAIL_CONFIG_KEY = 'automacao.email';
const MAX_ATTACHMENT_SIZE_MB = 25;
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.pdf'];

export interface EmailProcessingResult {
  readonly emailsFound: number;
  readonly attachmentsProcessed: number;
  readonly rowsIngested: number;
  readonly errors: readonly string[];
  readonly timestamp: string;
}

/**
 * Email Listener Service
 *
 * Orchestrates email fetching, attachment processing, and ETL pipeline integration.
 *
 * @see Story 4.3 — AC-4 through AC-11
 */
@Injectable()
export class EmailListenerService {
  private readonly logger = new Logger(EmailListenerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: IngestaoUploadService,
    private readonly pdfOcrService: PdfOcrService,
  ) {}

  async getConfig(): Promise<EmailListenerConfig | null> {
    const config = await this.prisma.configSistema.findUnique({
      where: { chave: EMAIL_CONFIG_KEY },
    });
    if (!config) return null;
    return config.valor as unknown as EmailListenerConfig;
  }

  async getConfigMasked(): Promise<EmailListenerConfig | null> {
    const config = await this.getConfig();
    if (!config) return null;

    const mask = '••••••••';
    return {
      ...config,
      gmail: config.gmail
        ? { clientId: config.gmail.clientId, clientSecret: mask, refreshToken: mask }
        : undefined,
      imap: config.imap
        ? { ...config.imap, password: mask }
        : undefined,
      sftp: config.sftp
        ? { ...config.sftp, password: config.sftp.password ? mask : undefined, privateKey: config.sftp.privateKey ? mask : undefined }
        : undefined,
    };
  }

  async saveConfig(config: EmailListenerConfig): Promise<EmailListenerConfig> {
    await this.prisma.configSistema.upsert({
      where: { chave: EMAIL_CONFIG_KEY },
      create: {
        chave: EMAIL_CONFIG_KEY,
        valor: config as any,
        descricao: 'Email listener configuration (adapter, filters, schedule)',
      },
      update: { valor: config as any },
    });
    return config;
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    const config = await this.getConfig();
    if (!config) throw new NotFoundException('Email listener configuration not found');

    try {
      const adapter = EmailAdapterFactory.create(config);
      const success = await adapter.testConnection();
      return { success };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async processEmails(): Promise<EmailProcessingResult> {
    const config = await this.getConfig();
    if (!config) throw new NotFoundException('Email listener configuration not found');

    const adapter = EmailAdapterFactory.create(config);
    const errors: string[] = [];
    let attachmentsProcessed = 0;
    let rowsIngested = 0;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const filters = {
      ...config.filters,
      since: config.filters.since ?? yesterday,
      hasAttachment: true,
    };

    const emails = await adapter.fetchEmails(filters);

    for (const email of emails) {
      for (const attachment of email.attachments) {
        try {
          this.validateAttachment(attachment, config);

          const buffer = await adapter.downloadAttachment(email.id, attachment.id);
          const result = await this.processAttachment(
            buffer,
            attachment.filename,
            config.templateId,
          );

          attachmentsProcessed++;
          rowsIngested += result.imported + result.updated;

          if (result.rejected > 0) {
            errors.push(
              `${attachment.filename}: ${result.rejected} rows rejected`,
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`${attachment.filename}: ${msg}`);
          this.logger.warn(`Failed to process attachment ${attachment.filename}: ${msg}`);
        }
      }
    }

    const result: EmailProcessingResult = {
      emailsFound: emails.length,
      attachmentsProcessed,
      rowsIngested,
      errors,
      timestamp: new Date().toISOString(),
    };

    await this.saveExecutionLog(result);

    return result;
  }

  async getExecutionLogs(limit: number = 20): Promise<EmailProcessingResult[]> {
    const logs = await this.prisma.configSistema.findUnique({
      where: { chave: 'automacao.email.logs' },
    });
    if (!logs) return [];
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    const allLogs = (logs.valor as unknown as EmailProcessingResult[]) ?? [];
    return allLogs.slice(-safeLimit);
  }

  private validateAttachment(attachment: EmailAttachment, config: EmailListenerConfig): void {
    const maxSizeBytes = (config.maxAttachmentSizeMb ?? MAX_ATTACHMENT_SIZE_MB) * 1024 * 1024;
    if (attachment.size > maxSizeBytes) {
      throw new Error(`File exceeds ${config.maxAttachmentSizeMb ?? MAX_ATTACHMENT_SIZE_MB}MB limit`);
    }

    const ext = '.' + (attachment.filename.split('.').pop()?.toLowerCase() ?? '');
    const allowed = config.allowedExtensions ?? ALLOWED_EXTENSIONS;
    if (!allowed.includes(ext)) {
      throw new Error(`Extension ${ext} not allowed. Allowed: ${allowed.join(', ')}`);
    }
  }

  private async processAttachment(
    buffer: Buffer,
    filename: string,
    templateId?: string,
  ): Promise<{ imported: number; updated: number; rejected: number }> {
    const ext = filename.split('.').pop()?.toLowerCase();

    let effectiveBuffer = buffer;
    let effectiveFilename = filename;

    if (ext === 'pdf') {
      const ocrResult = await this.pdfOcrService.extractFromPdf(buffer);
      if (ocrResult.rows.length === 0) {
        return { imported: 0, updated: 0, rejected: 0 };
      }
      const csvContent = this.pdfOcrService.toCsv(ocrResult);
      effectiveBuffer = Buffer.from(csvContent, 'utf-8');
      effectiveFilename = filename.replace(/\.pdf$/i, '.csv');
    }

    const effectiveExt = effectiveFilename.split('.').pop()?.toLowerCase();
    const mimeType = effectiveExt === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv';

    const file = {
      buffer: effectiveBuffer,
      mimetype: mimeType,
      originalname: effectiveFilename,
    } as Express.Multer.File;

    const result = await this.uploadService.processUpload(file, 'diario', templateId);
    return {
      imported: result.imported,
      updated: result.updated,
      rejected: result.rejected,
    };
  }

  private async saveExecutionLog(result: EmailProcessingResult): Promise<void> {
    const existing = await this.prisma.configSistema.findUnique({
      where: { chave: 'automacao.email.logs' },
    });

    const existingLogs: EmailProcessingResult[] = existing ? (existing.valor as unknown as EmailProcessingResult[]) : [];
    const updatedLogs = [...existingLogs, result];
    const trimmed = updatedLogs.slice(-100);

    await this.prisma.configSistema.upsert({
      where: { chave: 'automacao.email.logs' },
      create: {
        chave: 'automacao.email.logs',
        valor: trimmed as any,
        descricao: 'Email listener execution logs',
      },
      update: { valor: trimmed as any },
    });
  }
}
