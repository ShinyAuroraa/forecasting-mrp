/**
 * Automation types — ERP Connector + Email Listener.
 * @see Story 4.2 — ERP Connector (REST/DB/SFTP)
 * @see Story 4.3 — Email Listener & PDF Processing
 */

export type ConnectorType = 'REST' | 'DB' | 'SFTP';

export interface RestAuth {
  readonly type: 'apiKey' | 'bearer' | 'basic';
  readonly apiKey?: string;
  readonly headerName?: string;
  readonly token?: string;
  readonly username?: string;
  readonly password?: string;
}

export interface RestConnectorConfig {
  readonly url: string;
  readonly auth: RestAuth;
  readonly queryParams?: Record<string, string>;
  readonly responseFormat: 'JSON' | 'XML';
  readonly dataPath?: string;
}

export interface DbConnectorConfig {
  readonly connectionString: string;
  readonly query: string;
  readonly maxConnections: number;
}

export interface SftpConnectorConfig {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password?: string;
  readonly privateKey?: string;
  readonly remotePath: string;
  readonly filePattern: string;
  readonly pollIntervalMinutes: number;
}

export interface ErpConfig {
  readonly tipo: ConnectorType;
  readonly fallback?: ConnectorType;
  readonly templateId?: string;
  readonly granularidade?: 'diario' | 'semanal' | 'mensal';
  readonly rest?: RestConnectorConfig;
  readonly db?: DbConnectorConfig;
  readonly sftp?: SftpConnectorConfig;
}

export interface TestConnectionResult {
  readonly success: boolean;
  readonly error?: string;
}

export interface FetchResult {
  readonly connector: ConnectorType;
  readonly recordsFetched: number;
  readonly imported: number;
  readonly updated: number;
  readonly rejected: number;
  readonly errors: ReadonlyArray<{
    readonly row: number;
    readonly field: string;
    readonly message: string;
  }>;
  readonly usedFallback: boolean;
  readonly templateApplied: string | null;
}

/* ─── Email Listener Types (Story 4.3) ─── */

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

export interface EmailFilters {
  readonly sender?: string;
  readonly subjectPattern?: string;
  readonly hasAttachment?: boolean;
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

export interface EmailProcessingResult {
  readonly emailsFound: number;
  readonly attachmentsProcessed: number;
  readonly rowsIngested: number;
  readonly errors: readonly string[];
  readonly timestamp: string;
}

export interface EmailTestConnectionResult {
  readonly success: boolean;
  readonly error?: string;
}
