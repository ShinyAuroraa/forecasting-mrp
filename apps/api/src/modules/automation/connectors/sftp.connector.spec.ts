import { SftpConnector } from './sftp.connector';
import type { SftpConnectorConfig } from './erp-connector.interface';

const mockConnect = jest.fn();
const mockList = jest.fn();
const mockGet = jest.fn();
const mockEnd = jest.fn();

jest.mock('ssh2-sftp-client', () => {
  return jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    list: mockList,
    get: mockGet,
    end: mockEnd,
  }));
});

const SFTP_CONFIG: SftpConnectorConfig = {
  host: 'sftp.example.com',
  port: 22,
  username: 'erpuser',
  password: 'secret',
  remotePath: '/data/exports/',
  filePattern: 'fechamento_*.csv',
  pollIntervalMinutes: 60,
};

function createReadableFromString(content: string) {
  const { Readable } = require('stream');
  return Readable.from(Buffer.from(content, 'utf-8'));
}

describe('SftpConnector', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('fetchDailyData', () => {
    it('should connect, list, download and parse CSV files', async () => {
      const connector = new SftpConnector(SFTP_CONFIG);

      mockList.mockResolvedValue([
        { type: '-', name: 'fechamento_20260226.csv' },
        { type: '-', name: 'other_file.txt' },
        { type: 'd', name: 'subdir' },
      ]);

      const csvContent = 'sku,volume,data\nP001,100,2026-02-26\nP002,50,2026-02-26';
      mockGet.mockResolvedValue(createReadableFromString(csvContent));

      const result = await connector.fetchDailyData(new Date('2026-02-26'));

      expect(mockConnect).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'sftp.example.com',
          port: 22,
          username: 'erpuser',
          password: 'secret',
        }),
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ sku: 'P001', volume: '100', data: '2026-02-26' });
      expect(mockEnd).toHaveBeenCalled();
    });

    it('should return empty array when no matching files', async () => {
      const connector = new SftpConnector(SFTP_CONFIG);
      mockList.mockResolvedValue([
        { type: '-', name: 'other_file.txt' },
      ]);

      const result = await connector.fetchDailyData(new Date('2026-02-26'));
      expect(result).toEqual([]);
    });

    it('should always close connection even on error', async () => {
      const connector = new SftpConnector(SFTP_CONFIG);
      mockList.mockRejectedValue(new Error('Permission denied'));

      await expect(connector.fetchDailyData(new Date('2026-02-26'))).rejects.toThrow(
        'Permission denied',
      );
      expect(mockEnd).toHaveBeenCalled();
    });
  });

  describe('testConnection', () => {
    it('should return true when connection and list succeed', async () => {
      const connector = new SftpConnector(SFTP_CONFIG);
      mockList.mockResolvedValue([]);

      const result = await connector.testConnection();
      expect(result).toBe(true);
      expect(mockEnd).toHaveBeenCalled();
    });

    it('should throw on connection failure', async () => {
      const connector = new SftpConnector(SFTP_CONFIG);
      mockConnect.mockRejectedValue(new Error('Host unreachable'));

      await expect(connector.testConnection()).rejects.toThrow('Host unreachable');
      expect(mockEnd).toHaveBeenCalled();
    });
  });
});
