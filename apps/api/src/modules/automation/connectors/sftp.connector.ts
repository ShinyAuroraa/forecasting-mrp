import { Readable } from 'stream';
import {
  ErpConnector,
  RawMovementData,
  SftpConnectorConfig,
} from './erp-connector.interface';

/**
 * SFTP/Folder ERP Connector
 *
 * Connects to SFTP server, lists files matching a pattern,
 * downloads them, and parses as CSV.
 *
 * @see Story 4.2 — AC-10, AC-11, AC-12
 */
export class SftpConnector implements ErpConnector {
  constructor(private readonly config: SftpConnectorConfig) {}

  async fetchDailyData(date: Date): Promise<RawMovementData[]> {
    const SftpClient = await this.loadSftpClient();
    const sftp = new SftpClient();

    try {
      await sftp.connect({
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        password: this.config.password,
        privateKey: this.config.privateKey,
      });

      const files = await sftp.list(this.config.remotePath);
      const pattern = this.buildFileRegex(this.config.filePattern, date);
      const matchingFiles = files
        .filter((f: { type: string; name: string }) => f.type === '-' && pattern.test(f.name))
        .map((f: { name: string }) => f.name);

      if (matchingFiles.length === 0) {
        return [];
      }

      const allRows: RawMovementData[] = [];

      for (const fileName of matchingFiles) {
        const remotePath = `${this.config.remotePath.replace(/\/$/, '')}/${fileName}`;
        const stream: Readable = await sftp.get(remotePath);
        const buffer = await this.streamToBuffer(stream);
        const rows = this.parseCsv(buffer);
        allRows.push(...rows);
      }

      return allRows;
    } finally {
      await sftp.end();
    }
  }

  async testConnection(): Promise<boolean> {
    const SftpClient = await this.loadSftpClient();
    const sftp = new SftpClient();

    try {
      await sftp.connect({
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        password: this.config.password,
        privateKey: this.config.privateKey,
      });

      await sftp.list(this.config.remotePath);
      return true;
    } finally {
      await sftp.end();
    }
  }

  private async loadSftpClient(): Promise<any> {
    try {
      return (await import('ssh2-sftp-client')).default;
    } catch {
      throw new Error(
        'ssh2-sftp-client is not installed. Run: npm install ssh2-sftp-client',
      );
    }
  }

  private buildFileRegex(pattern: string, date: Date): RegExp {
    const formattedDate = date.toISOString().split('T')[0].replace(/-/g, '');
    const regexStr = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\{date\}/g, formattedDate);
    return new RegExp(`^${regexStr}$`, 'i');
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  private parseCsv(buffer: Buffer): RawMovementData[] {
    const content = buffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');

    if (lines.length < 2) return [];

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());

    const rows: RawMovementData[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter);
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j]?.trim() ?? '';
      }
      rows.push(row);
    }

    return rows;
  }
}
