import {
  EmailAdapter,
  EmailFilters,
  EmailMessage,
  ImapConfig,
} from './email-adapter.interface';

/**
 * IMAP Email Adapter
 *
 * Works with any IMAP-compatible email provider.
 * Uses dynamic import for imapflow to handle optional dependency.
 * @see Story 4.3 — AC-1
 */
export class ImapAdapter implements EmailAdapter {
  constructor(private readonly config: ImapConfig) {}

  async fetchEmails(filters: EmailFilters): Promise<EmailMessage[]> {
    const { ImapFlow } = await this.loadImapFlow();
    const client = new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.tls,
      auth: { user: this.config.username, pass: this.config.password },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        const searchCriteria: Record<string, unknown>[] = [];
        if (filters.since) searchCriteria.push({ since: filters.since });
        if (filters.until) searchCriteria.push({ before: filters.until });
        if (filters.sender) searchCriteria.push({ from: filters.sender });

        const searchQuery = searchCriteria.length > 0
          ? Object.assign({}, ...searchCriteria)
          : { since: new Date(Date.now() - 24 * 60 * 60 * 1000) };

        const messages: EmailMessage[] = [];

        for await (const msg of client.fetch(searchQuery, {
          envelope: true,
          bodyStructure: true,
        })) {
          const subject = msg.envelope?.subject ?? '';
          if (filters.subjectPattern) {
            try {
              const pattern = new RegExp(filters.subjectPattern, 'i');
              if (!pattern.test(subject)) continue;
            } catch {
              if (!subject.toLowerCase().includes(filters.subjectPattern.toLowerCase())) continue;
            }
          }

          const attachments = this.extractAttachments(msg.bodyStructure);
          if (filters.hasAttachment && attachments.length === 0) continue;

          messages.push({
            id: String(msg.uid),
            from: msg.envelope?.from?.[0]?.address ?? '',
            subject,
            date: msg.envelope?.date ?? new Date(),
            attachments,
          });
        }

        return messages;
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  async downloadAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    const { ImapFlow } = await this.loadImapFlow();
    const client = new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.tls,
      auth: { user: this.config.username, pass: this.config.password },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        const content = await client.download(messageId, attachmentId);
        const chunks: Buffer[] = [];
        for await (const chunk of content.content) {
          chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  async testConnection(): Promise<boolean> {
    const { ImapFlow } = await this.loadImapFlow();
    const client = new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.tls,
      auth: { user: this.config.username, pass: this.config.password },
      logger: false,
    });

    try {
      await client.connect();
      return true;
    } catch {
      return false;
    } finally {
      try { await client.logout(); } catch { /* ignore logout errors */ }
    }
  }

  private async loadImapFlow(): Promise<any> {
    try {
      return await import('imapflow');
    } catch {
      throw new Error('imapflow is not installed. Run: npm install imapflow');
    }
  }

  private extractAttachments(bodyStructure: any): { id: string; filename: string; mimeType: string; size: number }[] {
    const attachments: { id: string; filename: string; mimeType: string; size: number }[] = [];
    if (!bodyStructure) return attachments;

    const walk = (part: any, partPath: string) => {
      if (part.disposition === 'attachment' || part.filename) {
        attachments.push({
          id: partPath,
          filename: part.filename ?? `attachment_${partPath}`,
          mimeType: `${part.type ?? 'application'}/${part.subtype ?? 'octet-stream'}`,
          size: part.size ?? 0,
        });
      }
      if (part.childNodes) {
        part.childNodes.forEach((child: any, idx: number) => {
          walk(child, partPath ? `${partPath}.${idx + 1}` : `${idx + 1}`);
        });
      }
    };

    walk(bodyStructure, '');
    return attachments;
  }
}
