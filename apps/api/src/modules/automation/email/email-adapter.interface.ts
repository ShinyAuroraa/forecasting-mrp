/**
 * Email Adapter Interface & Types
 *
 * All email adapters implement this common interface.
 * @see Story 4.3 — AC-1, AC-2, AC-3
 */

export interface EmailFilters {
  readonly sender?: string;
  readonly subjectPattern?: string;
  readonly hasAttachment?: boolean;
  readonly since?: Date;
  readonly until?: Date;
}

export interface EmailAttachment {
  readonly id: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly size: number;
}

export interface EmailMessage {
  readonly id: string;
  readonly from: string;
  readonly subject: string;
  readonly date: Date;
  readonly attachments: readonly EmailAttachment[];
}

export interface EmailAdapter {
  fetchEmails(filters: EmailFilters): Promise<EmailMessage[]>;
  downloadAttachment(messageId: string, attachmentId: string): Promise<Buffer>;
  testConnection(): Promise<boolean>;
}

export type EmailAdapterType = 'GMAIL' | 'IMAP' | 'SFTP';

export interface GmailConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
}

export interface ImapConfig {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password: string;
  readonly tls: boolean;
}

export interface EmailSftpConfig {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password?: string;
  readonly privateKey?: string;
  readonly remotePath: string;
  readonly filePattern: string;
}

export interface EmailListenerConfig {
  readonly adapterType: EmailAdapterType;
  readonly gmail?: GmailConfig;
  readonly imap?: ImapConfig;
  readonly sftp?: EmailSftpConfig;
  readonly filters: EmailFilters;
  readonly cronExpression: string;
  readonly templateId?: string;
  readonly maxAttachmentSizeMb: number;
  readonly allowedExtensions: readonly string[];
}
