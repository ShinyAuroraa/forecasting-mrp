import { Readable } from 'stream';
import { SftpEmailAdapter } from './sftp-email.adapter';
import type { EmailSftpConfig } from './email-adapter.interface';

const mockSftpClient = {
  connect: jest.fn(),
  end: jest.fn(),
  list: jest.fn(),
  get: jest.fn(),
  stat: jest.fn(),
};

jest.mock('ssh2-sftp-client', () => {
  return jest.fn().mockImplementation(() => mockSftpClient);
});

describe('SftpEmailAdapter', () => {
  let adapter: SftpEmailAdapter;
  const config: EmailSftpConfig = {
    host: 'sftp.test.com',
    port: 22,
    username: 'user',
    password: 'pass',
    remotePath: '/emails/',
    filePattern: '*.csv',
  };

  beforeEach(() => {
    adapter = new SftpEmailAdapter(config);
    jest.clearAllMocks();
  });

  describe('testConnection', () => {
    it('should return true when connection succeeds', async () => {
      mockSftpClient.connect.mockResolvedValue(undefined);
      mockSftpClient.list.mockResolvedValue([]);
      mockSftpClient.end.mockResolvedValue(undefined);

      const result = await adapter.testConnection();
      expect(result).toBe(true);
    });

    it('should return false when connection fails', async () => {
      mockSftpClient.connect.mockRejectedValue(new Error('Connection refused'));

      const result = await adapter.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('fetchEmails', () => {
    it('should list files matching pattern and return as email messages', async () => {
      mockSftpClient.connect.mockResolvedValue(undefined);
      mockSftpClient.end.mockResolvedValue(undefined);
      mockSftpClient.list.mockResolvedValue([
        { name: 'report_2026.csv', size: 1024, modifyTime: Date.now(), type: '-' },
        { name: 'image.png', size: 512, modifyTime: Date.now(), type: '-' },
      ]);

      const emails = await adapter.fetchEmails({});
      expect(emails.length).toBeGreaterThanOrEqual(1);
      const csvEmail = emails.find((e) => e.attachments[0]?.filename === 'report_2026.csv');
      expect(csvEmail).toBeDefined();
    });

    it('should return empty when no matching files', async () => {
      mockSftpClient.connect.mockResolvedValue(undefined);
      mockSftpClient.end.mockResolvedValue(undefined);
      mockSftpClient.list.mockResolvedValue([]);

      const emails = await adapter.fetchEmails({});
      expect(emails).toEqual([]);
    });
  });

  describe('downloadAttachment', () => {
    it('should download file as buffer', async () => {
      mockSftpClient.connect.mockResolvedValue(undefined);
      mockSftpClient.end.mockResolvedValue(undefined);
      const mockStream = new Readable({
        read() {
          this.push(Buffer.from('csv data'));
          this.push(null);
        },
      });
      mockSftpClient.get.mockResolvedValue(mockStream);

      const buffer = await adapter.downloadAttachment('_', 'report.csv');
      expect(buffer.toString('utf-8')).toBe('csv data');
    });
  });
});
