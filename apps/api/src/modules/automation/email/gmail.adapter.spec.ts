import { GmailAdapter } from './gmail.adapter';
import type { GmailConfig } from './email-adapter.interface';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GmailAdapter', () => {
  let adapter: GmailAdapter;
  const config: GmailConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    refreshToken: 'test-refresh-token',
  };

  beforeEach(() => {
    adapter = new GmailAdapter(config);
    jest.clearAllMocks();
  });

  describe('testConnection', () => {
    it('should return true when token refresh and profile check succeed', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { access_token: 'new-token', expires_in: 3600 },
      });
      mockedAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

      const result = await adapter.testConnection();
      expect(result).toBe(true);
    });

    it('should throw when token refresh fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Unauthorized'));

      await expect(adapter.testConnection()).rejects.toThrow('Unauthorized');
    });
  });

  describe('fetchEmails', () => {
    it('should fetch and return email messages', async () => {
      // Token refresh
      mockedAxios.post.mockResolvedValueOnce({
        data: { access_token: 'token', expires_in: 3600 },
      });

      // Message list
      mockedAxios.get.mockResolvedValueOnce({
        data: { messages: [{ id: 'msg1' }] },
      });

      // Message detail
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          payload: {
            headers: [
              { name: 'From', value: 'erp@test.com' },
              { name: 'Subject', value: 'Fechamento diario' },
              { name: 'Date', value: '2026-02-26T06:00:00Z' },
            ],
            parts: [],
          },
        },
      });

      const emails = await adapter.fetchEmails({ since: new Date('2026-02-25') });
      expect(emails).toHaveLength(1);
      expect(emails[0].id).toBe('msg1');
      expect(emails[0].from).toBe('erp@test.com');
    });

    it('should return empty array when no messages found', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { access_token: 'token', expires_in: 3600 },
      });
      mockedAxios.get.mockResolvedValueOnce({ data: {} });

      const emails = await adapter.fetchEmails({});
      expect(emails).toEqual([]);
    });
  });

  describe('downloadAttachment', () => {
    it('should download attachment data', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { access_token: 'token', expires_in: 3600 },
      });

      const base64Data = Buffer.from('test data').toString('base64url');
      mockedAxios.get.mockResolvedValueOnce({
        data: { data: base64Data },
      });

      const buffer = await adapter.downloadAttachment('msg1', 'att1');
      expect(buffer.toString('utf-8')).toBe('test data');
    });
  });

  describe('token caching', () => {
    it('should reuse cached token within expiry window', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { access_token: 'cached-token', expires_in: 3600 },
      });
      mockedAxios.get.mockResolvedValue({ status: 200, data: {} });

      await adapter.testConnection();
      await adapter.testConnection();

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });
  });
});
