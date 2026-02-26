import { DirectDbConnector } from './direct-db.connector';
import type { DbConnectorConfig } from './erp-connector.interface';

const mockQuery = jest.fn();
const mockEnd = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery,
    end: mockEnd,
  })),
}));

const DB_CONFIG: DbConnectorConfig = {
  connectionString: 'postgresql://user:pass@localhost:5432/erp',
  query: 'SELECT sku, volume, data_movimento FROM movimentacoes WHERE data_movimento = $1',
  maxConnections: 5,
};

describe('DirectDbConnector', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('fetchDailyData', () => {
    it('should execute query with date parameter', async () => {
      const connector = new DirectDbConnector(DB_CONFIG);
      const rows = [
        { sku: 'P001', volume: 100, data_movimento: '2026-02-26' },
        { sku: 'P002', volume: 50, data_movimento: '2026-02-26' },
      ];
      mockQuery.mockResolvedValue({ rows });

      const result = await connector.fetchDailyData(new Date('2026-02-26'));

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(rows[0]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('data_movimento = $1'),
        ['2026-02-26'],
      );
    });

    it('should append WHERE clause if query has no $1 placeholder', async () => {
      const connector = new DirectDbConnector({
        ...DB_CONFIG,
        query: 'SELECT * FROM movimentacoes',
      });
      mockQuery.mockResolvedValue({ rows: [] });

      await connector.fetchDailyData(new Date('2026-02-26'));

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM movimentacoes WHERE data_movimento = $1',
        ['2026-02-26'],
      );
    });

    it('should respect max 5 connections', async () => {
      const { Pool } = require('pg');
      const connector = new DirectDbConnector({
        ...DB_CONFIG,
        maxConnections: 10,
      });
      mockQuery.mockResolvedValue({ rows: [] });

      await connector.fetchDailyData(new Date('2026-02-26'));

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({ max: 5 }),
      );
    });
  });

  describe('testConnection', () => {
    it('should return true when SELECT 1 succeeds', async () => {
      const connector = new DirectDbConnector(DB_CONFIG);
      mockQuery.mockResolvedValue({ rows: [{ ok: 1 }] });

      const result = await connector.testConnection();
      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith('SELECT 1 AS ok');
    });

    it('should throw on connection failure', async () => {
      const connector = new DirectDbConnector(DB_CONFIG);
      mockQuery.mockRejectedValue(new Error('Connection refused'));

      await expect(connector.testConnection()).rejects.toThrow('Connection refused');
    });
  });

  describe('dispose', () => {
    it('should close the pool', async () => {
      const connector = new DirectDbConnector(DB_CONFIG);
      mockQuery.mockResolvedValue({ rows: [] });
      await connector.fetchDailyData(new Date('2026-02-26'));

      await connector.dispose();
      expect(mockEnd).toHaveBeenCalled();
    });
  });
});
