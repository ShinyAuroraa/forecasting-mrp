import { ImapAdapter } from './imap.adapter';
import type { ImapConfig } from './email-adapter.interface';

const mockImapClient = {
  connect: jest.fn(),
  logout: jest.fn(),
  search: jest.fn(),
  fetchOne: jest.fn(),
  download: jest.fn(),
};

jest.mock('imapflow', () => ({
  ImapFlow: jest.fn().mockImplementation(() => mockImapClient),
}));

describe('ImapAdapter', () => {
  let adapter: ImapAdapter;
  const config: ImapConfig = {
    host: 'imap.test.com',
    port: 993,
    username: 'user@test.com',
    password: 'password123',
    tls: true,
  };

  beforeEach(() => {
    adapter = new ImapAdapter(config);
    jest.clearAllMocks();
  });

  describe('testConnection', () => {
    it('should return true when connection succeeds', async () => {
      mockImapClient.connect.mockResolvedValue(undefined);
      mockImapClient.logout.mockResolvedValue(undefined);

      const result = await adapter.testConnection();
      expect(result).toBe(true);
      expect(mockImapClient.connect).toHaveBeenCalled();
      expect(mockImapClient.logout).toHaveBeenCalled();
    });

    it('should return false when connection fails', async () => {
      mockImapClient.connect.mockRejectedValue(new Error('Connection refused'));

      const result = await adapter.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('fetchEmails', () => {
    it('should search and return emails', async () => {
      mockImapClient.connect.mockResolvedValue(undefined);
      mockImapClient.logout.mockResolvedValue(undefined);
      mockImapClient.search.mockResolvedValue([1]);
      mockImapClient.fetchOne.mockResolvedValue({
        uid: 1,
        envelope: {
          from: [{ address: 'erp@test.com' }],
          subject: 'Fechamento',
          date: new Date('2026-02-26'),
        },
        bodyStructure: { childNodes: [] },
      });

      const emails = await adapter.fetchEmails({ since: new Date('2026-02-25') });
      expect(emails).toHaveLength(1);
    });

    it('should return empty when no results', async () => {
      mockImapClient.connect.mockResolvedValue(undefined);
      mockImapClient.logout.mockResolvedValue(undefined);
      mockImapClient.search.mockResolvedValue([]);

      const emails = await adapter.fetchEmails({});
      expect(emails).toEqual([]);
    });
  });
});
