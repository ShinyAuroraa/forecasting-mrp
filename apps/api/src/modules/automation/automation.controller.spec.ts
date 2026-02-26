import { NotFoundException } from '@nestjs/common';
import { AutomationController } from './automation.controller';

const mockService = {
  getConfig: jest.fn(),
  getConfigMasked: jest.fn(),
  saveConfig: jest.fn(),
  testConnection: jest.fn(),
  fetchDailyData: jest.fn(),
};

describe('AutomationController', () => {
  let controller: AutomationController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AutomationController(mockService as any);
  });

  describe('getConfig', () => {
    it('should return masked config when it exists', async () => {
      const config = { tipo: 'REST', rest: { auth: { token: '••••••••' } } };
      mockService.getConfigMasked.mockResolvedValue(config);
      const result = await controller.getConfig();
      expect(result).toEqual(config);
      expect(mockService.getConfigMasked).toHaveBeenCalled();
    });

    it('should throw NotFoundException when no config', async () => {
      mockService.getConfigMasked.mockResolvedValue(null);
      await expect(controller.getConfig()).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateConfig', () => {
    it('should call service.saveConfig with DTO', async () => {
      const dto = { tipo: 'REST', rest: { url: 'http://test.com' } };
      mockService.saveConfig.mockResolvedValue(dto);
      const result = await controller.updateConfig(dto as any);
      expect(result).toEqual(dto);
      expect(mockService.saveConfig).toHaveBeenCalledWith(dto);
    });
  });

  describe('testConnection', () => {
    it('should call service.testConnection with optional tipo', async () => {
      mockService.testConnection.mockResolvedValue({ success: true });
      const result = await controller.testConnection({ tipo: 'DB' });
      expect(result).toEqual({ success: true });
      expect(mockService.testConnection).toHaveBeenCalledWith('DB');
    });

    it('should pass undefined when no tipo specified', async () => {
      mockService.testConnection.mockResolvedValue({ success: true });
      await controller.testConnection({});
      expect(mockService.testConnection).toHaveBeenCalledWith(undefined);
    });
  });

  describe('fetchDailyData', () => {
    it('should call service.fetchDailyData with no date', async () => {
      const fetchResult = { connector: 'REST', recordsFetched: 10, imported: 10 };
      mockService.fetchDailyData.mockResolvedValue(fetchResult);
      const result = await controller.fetchDailyData({});
      expect(result).toEqual(fetchResult);
      expect(mockService.fetchDailyData).toHaveBeenCalledWith(undefined);
    });

    it('should parse date string when provided', async () => {
      mockService.fetchDailyData.mockResolvedValue({ connector: 'REST', recordsFetched: 0 });
      await controller.fetchDailyData({ date: '2026-02-26' });
      expect(mockService.fetchDailyData).toHaveBeenCalledWith(expect.any(Date));
    });
  });
});
