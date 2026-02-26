import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { buildPaginatedResponse } from '../../../common/dto/paginated-response.dto';
import { EmailSenderService } from './email-sender.service';
import { EmailAggregatorService } from './email-aggregator.service';
import { buildSummaryHtml, buildSummaryText } from './email-templates';
import {
  CONFIG_KEY_RECIPIENTS,
  DEFAULT_RECIPIENTS_CONFIG,
} from './daily-summary.types';
import type {
  EmailType,
  EmailRecipientsConfig,
  EmailSendResult,
  EmailHistoryEntry,
  SmtpConfig,
} from './daily-summary.types';
import type { FilterEmailDto } from './dto/filter-email.dto';
import type { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';

const EMAIL_LOG_PREFIX = 'email_log_';

/**
 * DailySummaryService — Orchestrates data aggregation, template rendering, and email sending.
 *
 * Called by the daily pipeline step 7 ('email') and manually via API.
 * Stores email execution logs in ConfigSistema for history tracking.
 *
 * @see Story 4.7 — AC-1 through AC-18
 */
@Injectable()
export class DailySummaryService {
  private readonly logger = new Logger(DailySummaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailSender: EmailSenderService,
    private readonly aggregator: EmailAggregatorService,
  ) {}

  // ────────────────────────────────────────────────────────────────
  // Recipients Config (AC-3, AC-10, AC-12)
  // ────────────────────────────────────────────────────────────────

  async getRecipientsConfig(): Promise<EmailRecipientsConfig> {
    const row = await this.prisma.configSistema.findUnique({
      where: { chave: CONFIG_KEY_RECIPIENTS },
    });

    if (!row) {
      return { ...DEFAULT_RECIPIENTS_CONFIG };
    }

    const stored = row.valor as Record<string, unknown>;
    return {
      summary: (stored.summary as string[]) ?? DEFAULT_RECIPIENTS_CONFIG.summary,
      briefing: (stored.briefing as string[]) ?? DEFAULT_RECIPIENTS_CONFIG.briefing,
      cc: (stored.cc as string[]) ?? DEFAULT_RECIPIENTS_CONFIG.cc,
      bcc: (stored.bcc as string[]) ?? DEFAULT_RECIPIENTS_CONFIG.bcc,
    };
  }

  async saveRecipientsConfig(config: EmailRecipientsConfig): Promise<EmailRecipientsConfig> {
    await this.prisma.configSistema.upsert({
      where: { chave: CONFIG_KEY_RECIPIENTS },
      create: {
        chave: CONFIG_KEY_RECIPIENTS,
        valor: config as any,
        descricao: 'Email recipients for daily summary and briefing',
      },
      update: {
        valor: config as any,
      },
    });
    return config;
  }

  // ────────────────────────────────────────────────────────────────
  // Full Config (SMTP + Recipients) for API (AC-15, AC-16)
  // ────────────────────────────────────────────────────────────────

  async getFullConfig(): Promise<{
    smtp: SmtpConfig;
    recipients: EmailRecipientsConfig;
  }> {
    const [smtp, recipients] = await Promise.all([
      this.emailSender.getSmtpConfig(),
      this.getRecipientsConfig(),
    ]);

    // Mask password for API response
    return {
      smtp: { ...smtp, pass: smtp.pass ? '********' : '' },
      recipients,
    };
  }

  async saveFullConfig(params: {
    smtp: SmtpConfig;
    recipients: EmailRecipientsConfig;
  }): Promise<void> {
    // Treat masked sentinel as "keep existing password"
    let smtpToSave = params.smtp;
    if (params.smtp.pass === '********' || params.smtp.pass === '') {
      const existing = await this.emailSender.getSmtpConfig();
      smtpToSave = { ...params.smtp, pass: existing.pass };
    }

    await Promise.all([
      this.emailSender.saveSmtpConfig(smtpToSave),
      this.saveRecipientsConfig(params.recipients),
    ]);
  }

  // ────────────────────────────────────────────────────────────────
  // Send Summary / Briefing (AC-1, AC-7, AC-11, AC-12)
  // ────────────────────────────────────────────────────────────────

  async sendSummary(executionId?: string): Promise<EmailSendResult> {
    return this.sendEmail('RESUMO_DIARIO', executionId);
  }

  async sendBriefing(executionId?: string): Promise<EmailSendResult> {
    return this.sendEmail('BRIEFING_MATINAL', executionId);
  }

  private async sendEmail(
    tipo: EmailType,
    executionId?: string,
  ): Promise<EmailSendResult> {
    const recipients = await this.getRecipientsConfig();
    const to = tipo === 'BRIEFING_MATINAL' ? recipients.briefing : recipients.summary;

    if (to.length === 0) {
      this.logger.warn(`No recipients configured for ${tipo}. Email not sent.`);
      const result: EmailSendResult = {
        success: true,
        messageId: null,
        recipients: [],
        error: null,
      };
      await this.logEmailExecution(tipo, result);
      return result;
    }

    // Aggregate data
    const data = await this.aggregator.aggregateDailySummary(executionId);

    // Build templates
    const subject = tipo === 'BRIEFING_MATINAL'
      ? `Briefing Matinal — ${data.date}`
      : `Resumo Diario — ${data.date}`;
    const html = buildSummaryHtml(data, tipo);
    const text = buildSummaryText(data, tipo);

    // Send
    const result = await this.emailSender.sendEmail({
      to,
      cc: recipients.cc,
      bcc: recipients.bcc,
      subject,
      html,
      text,
    });

    // Log execution
    await this.logEmailExecution(tipo, result);

    if (!result.success) {
      this.logger.error(`Failed to send ${tipo}: ${result.error}`);
    } else {
      this.logger.log(`${tipo} sent to ${to.join(', ')}`);
    }

    return result;
  }

  // ────────────────────────────────────────────────────────────────
  // History (AC-18)
  // ────────────────────────────────────────────────────────────────

  async getHistory(filters: FilterEmailDto): Promise<PaginatedResponseDto<EmailHistoryEntry>> {
    const { page = 1, limit = 20, sortOrder = 'desc' } = filters;

    // Email logs stored in ConfigSistema with prefix key (capped to prevent memory exhaustion)
    const allLogs = await this.prisma.configSistema.findMany({
      where: {
        chave: { startsWith: EMAIL_LOG_PREFIX },
      },
      orderBy: { updatedAt: sortOrder as 'asc' | 'desc' },
      take: 500,
    });

    let entries: EmailHistoryEntry[] = allLogs.map((row) => {
      const val = row.valor as Record<string, unknown>;
      return {
        id: row.chave.replace(EMAIL_LOG_PREFIX, ''),
        tipo: (val.tipo as EmailType) ?? 'RESUMO_DIARIO',
        destinatarios: (val.recipients as string[]) ?? [],
        assunto: (val.subject as string) ?? '',
        statusEnvio: val.success ? 'ENVIADO' as const : val.messageId === null && val.error === null ? 'NOOP' as const : 'FALHA' as const,
        tentativas: 1,
        ultimoErro: (val.error as string) ?? null,
        enviadoEm: val.sentAt ? new Date(val.sentAt as string) : null,
        criadoEm: new Date(val.createdAt as string),
      };
    });

    // Apply filters
    if (filters.tipo) {
      entries = entries.filter((e) => e.tipo === filters.tipo);
    }
    if (filters.status) {
      entries = entries.filter((e) => e.statusEnvio === filters.status);
    }

    const total = entries.length;
    const paged = entries.slice((page - 1) * limit, page * limit);

    return buildPaginatedResponse(paged, total, page, limit);
  }

  private async logEmailExecution(
    tipo: EmailType,
    result: EmailSendResult,
  ): Promise<void> {
    const logKey = `${EMAIL_LOG_PREFIX}${Date.now()}_${tipo}`;
    try {
      await this.prisma.configSistema.create({
        data: {
          chave: logKey,
          valor: {
            tipo,
            recipients: result.recipients,
            subject: tipo === 'BRIEFING_MATINAL' ? 'Briefing Matinal' : 'Resumo Diario',
            success: result.success,
            messageId: result.messageId,
            error: result.error,
            sentAt: result.success ? new Date().toISOString() : null,
            createdAt: new Date().toISOString(),
          },
          descricao: `Email log: ${tipo}`,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to log email execution: ${(error as Error).message}`);
    }
  }
}
