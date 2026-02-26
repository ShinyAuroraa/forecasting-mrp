import axios from 'axios';
import {
  EmailAdapter,
  EmailFilters,
  EmailMessage,
  GmailConfig,
} from './email-adapter.interface';

const GMAIL_API_BASE = 'https://www.googleapis.com/gmail/v1/users/me';

/**
 * Gmail API Adapter (OAuth2)
 *
 * Uses Gmail REST API with OAuth2 refresh token.
 * @see Story 4.3 — AC-1
 */
export class GmailAdapter implements EmailAdapter {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(private readonly config: GmailConfig) {}

  async fetchEmails(filters: EmailFilters): Promise<EmailMessage[]> {
    const token = await this.getAccessToken();
    const query = this.buildQuery(filters);

    const listRes = await axios.get(`${GMAIL_API_BASE}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { q: query, maxResults: 50 },
    });

    const messageIds: string[] = (listRes.data.messages ?? []).map(
      (m: { id: string }) => m.id,
    );

    const messages: EmailMessage[] = [];
    for (const id of messageIds) {
      const msgRes = await axios.get(`${GMAIL_API_BASE}/messages/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] },
      });

      const headers = msgRes.data.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h: { name: string }) => h.name === name)?.value ?? '';

      const attachments = (msgRes.data.payload?.parts ?? [])
        .filter((p: { filename?: string }) => p.filename)
        .map((p: { body: { attachmentId: string; size: number }; filename: string; mimeType: string }) => ({
          id: p.body.attachmentId,
          filename: p.filename,
          mimeType: p.mimeType,
          size: p.body.size,
        }));

      messages.push({
        id,
        from: getHeader('From'),
        subject: getHeader('Subject'),
        date: new Date(getHeader('Date')),
        attachments,
      });
    }

    return messages;
  }

  async downloadAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    const token = await this.getAccessToken();
    const res = await axios.get(
      `${GMAIL_API_BASE}/messages/${messageId}/attachments/${attachmentId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const base64Url = res.data.data as string;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64');
  }

  async testConnection(): Promise<boolean> {
    const token = await this.getAccessToken();
    const res = await axios.get(`${GMAIL_API_BASE}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.status === 200;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const res = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: this.config.refreshToken,
      grant_type: 'refresh_token',
    });

    this.accessToken = res.data.access_token;
    this.tokenExpiresAt = Date.now() + ((res.data.expires_in ?? 3600) * 1000);
    return this.accessToken!;
  }

  private buildQuery(filters: EmailFilters): string {
    const parts: string[] = [];
    if (filters.sender) parts.push(`from:${filters.sender}`);
    if (filters.subjectPattern) {
      const escaped = filters.subjectPattern.replace(/[()]/g, '');
      parts.push(`subject:(${escaped})`);
    }
    if (filters.hasAttachment) parts.push('has:attachment');
    if (filters.since) parts.push(`after:${this.formatDate(filters.since)}`);
    if (filters.until) parts.push(`before:${this.formatDate(filters.until)}`);
    return parts.join(' ');
  }

  private formatDate(d: Date): string {
    return d.toISOString().split('T')[0].replace(/-/g, '/');
  }
}
