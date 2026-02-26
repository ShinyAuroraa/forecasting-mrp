import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import { PrismaService } from '../../../prisma/prisma.service';
import {
  CONFIG_KEY_SMTP,
  DEFAULT_SMTP_CONFIG,
} from './daily-summary.types';
import type { SmtpConfig, EmailSendResult } from './daily-summary.types';

/**
 * EmailSenderService — Nodemailer wrapper with SMTP config from ConfigSistema.
 *
 * Loads SMTP config lazily, creates transport on first send.
 * If SMTP not configured (empty user), operates as no-op so pipeline continues.
 *
 * @see Story 4.7 — AC-1, AC-2, AC-11
 */
@Injectable()
export class EmailSenderService {
  private readonly logger = new Logger(EmailSenderService.name);
  private transporter: Transporter | null = null;
  private lastConfig: SmtpConfig | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async getSmtpConfig(): Promise<SmtpConfig> {
    const row = await this.prisma.configSistema.findUnique({
      where: { chave: CONFIG_KEY_SMTP },
    });

    if (!row) {
      return { ...DEFAULT_SMTP_CONFIG };
    }

    const stored = row.valor as Record<string, unknown>;
    return {
      host: (stored.host as string) ?? DEFAULT_SMTP_CONFIG.host,
      port: (stored.port as number) ?? DEFAULT_SMTP_CONFIG.port,
      secure: (stored.secure as boolean) ?? DEFAULT_SMTP_CONFIG.secure,
      user: (stored.user as string) ?? DEFAULT_SMTP_CONFIG.user,
      pass: (stored.pass as string) ?? DEFAULT_SMTP_CONFIG.pass,
      fromAddress: (stored.fromAddress as string) ?? DEFAULT_SMTP_CONFIG.fromAddress,
      fromName: (stored.fromName as string) ?? DEFAULT_SMTP_CONFIG.fromName,
    };
  }

  async saveSmtpConfig(config: SmtpConfig): Promise<SmtpConfig> {
    await this.prisma.configSistema.upsert({
      where: { chave: CONFIG_KEY_SMTP },
      create: {
        chave: CONFIG_KEY_SMTP,
        valor: config as any,
        descricao: 'SMTP configuration for outgoing emails',
      },
      update: {
        valor: config as any,
      },
    });

    // Reset transporter so next send picks up new config
    this.transporter = null;
    this.lastConfig = null;

    return config;
  }

  async sendEmail(params: {
    readonly to: readonly string[];
    readonly cc?: readonly string[];
    readonly bcc?: readonly string[];
    readonly subject: string;
    readonly html: string;
    readonly text: string;
  }): Promise<EmailSendResult> {
    const config = await this.getSmtpConfig();

    // No-op if SMTP not configured
    if (!config.user || !config.pass) {
      this.logger.warn('SMTP not configured (empty user/pass). Email not sent.');
      return {
        success: true,
        messageId: null,
        recipients: params.to,
        error: null,
      };
    }

    try {
      const transport = await this.getOrCreateTransporter(config);

      const info = await transport.sendMail({
        from: `"${config.fromName}" <${config.fromAddress}>`,
        to: params.to.join(', '),
        cc: params.cc?.join(', ') ?? undefined,
        bcc: params.bcc?.join(', ') ?? undefined,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });

      this.logger.log(`Email sent: ${info.messageId} to ${params.to.join(', ')}`);

      return {
        success: true,
        messageId: info.messageId,
        recipients: params.to,
        error: null,
      };
    } catch (error) {
      const errMsg = (error as Error).message;
      this.logger.error(`Failed to send email: ${errMsg}`);

      return {
        success: false,
        messageId: null,
        recipients: params.to,
        error: errMsg,
      };
    }
  }

  private async getOrCreateTransporter(config: SmtpConfig): Promise<Transporter> {
    // Recreate if config changed
    if (
      this.transporter &&
      this.lastConfig &&
      this.lastConfig.host === config.host &&
      this.lastConfig.port === config.port &&
      this.lastConfig.user === config.user &&
      this.lastConfig.pass === config.pass
    ) {
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    this.lastConfig = config;
    return this.transporter;
  }
}
