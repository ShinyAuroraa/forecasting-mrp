/**
 * Daily Summary & Morning Briefing Emails — Frontend Types
 *
 * @see Story 4.7 — AC-13 through AC-18
 */

export type EmailType = 'RESUMO_DIARIO' | 'BRIEFING_MATINAL';
export type EmailSendStatus = 'ENVIADO' | 'FALHA' | 'NOOP';

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string;
  readonly pass: string;
  readonly fromAddress: string;
  readonly fromName: string;
}

export interface EmailRecipientsConfig {
  readonly summary: readonly string[];
  readonly briefing: readonly string[];
  readonly cc: readonly string[];
  readonly bcc: readonly string[];
}

export interface EmailFullConfig {
  readonly smtp: SmtpConfig;
  readonly recipients: EmailRecipientsConfig;
}

export interface EmailSendResult {
  readonly success: boolean;
  readonly messageId: string | null;
  readonly recipients: readonly string[];
  readonly error: string | null;
}

export interface EmailHistoryEntry {
  readonly id: string;
  readonly tipo: EmailType;
  readonly destinatarios: readonly string[];
  readonly assunto: string;
  readonly statusEnvio: EmailSendStatus;
  readonly tentativas: number;
  readonly ultimoErro: string | null;
  readonly enviadoEm: string | null;
  readonly criadoEm: string;
}

export interface PaginatedEmailResponse {
  readonly data: readonly EmailHistoryEntry[];
  readonly meta: {
    readonly total: number;
    readonly page: number;
    readonly limit: number;
    readonly totalPages: number;
    readonly hasNext: boolean;
    readonly hasPrev: boolean;
  };
}

export const EMAIL_TYPE_LABELS: Record<EmailType, string> = {
  RESUMO_DIARIO: 'Resumo Diario',
  BRIEFING_MATINAL: 'Briefing Matinal',
};

export const EMAIL_STATUS_LABELS: Record<EmailSendStatus, string> = {
  ENVIADO: 'Enviado',
  FALHA: 'Falha',
  NOOP: 'Sem Acao',
};

export const EMAIL_STATUS_COLORS: Record<EmailSendStatus, string> = {
  ENVIADO: 'bg-green-100 text-green-800',
  FALHA: 'bg-red-100 text-red-800',
  NOOP: 'bg-gray-100 text-gray-800',
};
