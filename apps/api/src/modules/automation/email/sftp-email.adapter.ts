import * as path from 'path';
import {
  EmailAdapter,
  EmailFilters,
  EmailMessage,
  EmailSftpConfig,
} from './email-adapter.interface';
import { Readable } from 'stream';

/**
 * SFTP/Folder Email Adapter
 *
 * Monitors a shared folder (via SFTP) for data files.
 * Treats each file as an "email" with a single attachment.
 * @see Story 4.3 — AC-1
 */
export class SftpEmailAdapter implements EmailAdapter {
  constructor(private readonly config: EmailSftpConfig) {}

  async fetchEmails(filters: EmailFilters): Promise<EmailMessage[]> {
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
      const pattern = this.buildFileRegex(this.config.filePattern);

      return files
        .filter((f: { type: string; name: string; modifyTime: number }) => {
          if (f.type !== '-') return false;
          if (!pattern.test(f.name)) return false;
          if (filters.since) {
            const fileDate = new Date(f.modifyTime);
            if (fileDate < filters.since) return false;
          }
          return true;
        })
        .map((f: { name: string; modifyTime: number; size: number }) => ({
          id: f.name,
          from: 'sftp-folder',
          subject: f.name,
          date: new Date(f.modifyTime),
          attachments: [{
            id: f.name,
            filename: f.name,
            mimeType: this.getMimeType(f.name),
            size: f.size,
          }],
        }));
    } finally {
      await sftp.end();
    }
  }

  async downloadAttachment(_messageId: string, attachmentId: string): Promise<Buffer> {
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

      const sanitizedId = path.basename(attachmentId);
      const remotePath = `${this.config.remotePath.replace(/\/$/, '')}/${sanitizedId}`;
      const stream: Readable = await sftp.get(remotePath);
      const chunks: Buffer[] = [];
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', async () => {
          await sftp.end();
          resolve(Buffer.concat(chunks));
        });
        stream.on('error', async (err) => {
          await sftp.end();
          reject(err);
        });
      });
    } catch (err) {
      await sftp.end();
      throw err;
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
      await sftp.end();
      return true;
    } catch {
      return false;
    }
  }

  private async loadSftpClient(): Promise<any> {
    try {
      return (await import('ssh2-sftp-client')).default;
    } catch {
      throw new Error('ssh2-sftp-client is not installed. Run: npm install ssh2-sftp-client');
    }
  }

  private buildFileRegex(pattern: string): RegExp {
    const regexStr = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
    return new RegExp(`^${regexStr}$`, 'i');
  }

  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'csv': return 'text/csv';
      case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'pdf': return 'application/pdf';
      default: return 'application/octet-stream';
    }
  }
}
