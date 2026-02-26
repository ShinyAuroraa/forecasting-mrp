/**
 * ERP Connector Interface & Types
 *
 * All connectors implement this common interface for daily data fetching.
 * @see Story 4.2 — AC-1, AC-2
 */

export interface RawMovementData {
  readonly [key: string]: string | number | boolean | null | undefined;
}

export interface ErpConnector {
  /** Fetch movement data for a specific date. */
  fetchDailyData(date: Date): Promise<RawMovementData[]>;

  /** Validate the current connector configuration by attempting a connection. */
  testConnection(): Promise<boolean>;
}

export type ConnectorType = 'REST' | 'DB' | 'SFTP';

export interface RestConnectorConfig {
  readonly url: string;
  readonly auth: {
    readonly type: 'apiKey' | 'bearer' | 'basic';
    readonly apiKey?: string;
    readonly headerName?: string;
    readonly token?: string;
    readonly username?: string;
    readonly password?: string;
  };
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
