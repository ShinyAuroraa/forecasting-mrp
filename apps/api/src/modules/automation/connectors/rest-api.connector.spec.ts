import axios from 'axios';
import { RestApiConnector } from './rest-api.connector';
import type { RestConnectorConfig } from './erp-connector.interface';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const BASE_REST_CONFIG: RestConnectorConfig = {
  url: 'https://erp.example.com/api/movimentacoes',
  auth: { type: 'bearer', token: 'test-token' },
  responseFormat: 'JSON',
  queryParams: { data: '{yesterday}' },
};

describe('RestApiConnector', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('fetchDailyData', () => {
    it('should fetch JSON data with bearer auth', async () => {
      const connector = new RestApiConnector(BASE_REST_CONFIG);
      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: [{ sku: 'P001', volume: 100 }],
      });

      const result = await connector.fetchDailyData(new Date('2026-02-26'));

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ sku: 'P001', volume: 100 });
      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://erp.example.com/api/movimentacoes',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      );
    });

    it('should support API key auth', async () => {
      const connector = new RestApiConnector({
        ...BASE_REST_CONFIG,
        auth: { type: 'apiKey', apiKey: 'my-key', headerName: 'X-Custom-Key' },
      });

      mockedAxios.request.mockResolvedValue({ status: 200, data: [] });
      await connector.fetchDailyData(new Date('2026-02-26'));

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Custom-Key': 'my-key' }),
        }),
      );
    });

    it('should support basic auth', async () => {
      const connector = new RestApiConnector({
        ...BASE_REST_CONFIG,
        auth: { type: 'basic', username: 'user', password: 'pass' },
      });

      mockedAxios.request.mockResolvedValue({ status: 200, data: [] });
      await connector.fetchDailyData(new Date('2026-02-26'));

      const encoded = Buffer.from('user:pass').toString('base64');
      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: `Basic ${encoded}` }),
        }),
      );
    });

    it('should extract data from nested JSON path', async () => {
      const connector = new RestApiConnector({
        ...BASE_REST_CONFIG,
        dataPath: 'result.items',
      });

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { result: { items: [{ sku: 'P001' }] } },
      });

      const result = await connector.fetchDailyData(new Date('2026-02-26'));
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ sku: 'P001' });
    });

    it('should parse XML response', async () => {
      const connector = new RestApiConnector({
        ...BASE_REST_CONFIG,
        responseFormat: 'XML',
      });

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: '<items><item><sku>P001</sku><volume>100</volume></item></items>',
      });

      const result = await connector.fetchDailyData(new Date('2026-02-26'));
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ sku: 'P001', volume: '100' });
    });

    it('should return empty array when JSON path does not exist', async () => {
      const connector = new RestApiConnector({
        ...BASE_REST_CONFIG,
        dataPath: 'nonexistent.path',
      });

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { other: 'data' },
      });

      const result = await connector.fetchDailyData(new Date('2026-02-26'));
      expect(result).toEqual([]);
    });
  });

  describe('testConnection', () => {
    it('should return true on successful response', async () => {
      const connector = new RestApiConnector(BASE_REST_CONFIG);
      mockedAxios.request.mockResolvedValue({ status: 200, data: [] });
      const result = await connector.testConnection();
      expect(result).toBe(true);
    });

    it('should throw on network error', async () => {
      const connector = new RestApiConnector(BASE_REST_CONFIG);
      mockedAxios.request.mockRejectedValue(new Error('Network error'));
      await expect(connector.testConnection()).rejects.toThrow('Network error');
    });
  });
});
