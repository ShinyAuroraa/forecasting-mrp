import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EmailListenerController } from './email-listener.controller';
import { EmailListenerService } from './email-listener.service';

describe('EmailListenerController', () => {
  let controller: EmailListenerController;
  let service: jest.Mocked<EmailListenerService>;

  const mockConfig = {
    adapterType: 'IMAP' as const,
    imap: { host: 'imap.test.com', port: 993, username: 'user', password: 'pass', tls: true },
    filters: { sender: 'erp@test.com' },
    cronExpression: '0 6 * * *',
    maxAttachmentSizeMb: 25,
    allowedExtensions: ['.csv', '.xlsx', '.pdf'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailListenerController],
      providers: [
        {
          provide: EmailListenerService,
          useValue: {
            getConfig: jest.fn(),
            getConfigMasked: jest.fn(),
            saveConfig: jest.fn(),
            testConnection: jest.fn(),
            processEmails: jest.fn(),
            getExecutionLogs: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(EmailListenerController);
    service = module.get(EmailListenerService);
  });

  describe('getConfig', () => {
    it('should return masked config when found', async () => {
      service.getConfigMasked.mockResolvedValue(mockConfig as any);
      const result = await controller.getConfig();
      expect(result).toEqual(mockConfig);
      expect(service.getConfigMasked).toHaveBeenCalled();
    });

    it('should throw NotFoundException when no config', async () => {
      service.getConfigMasked.mockResolvedValue(null);
      await expect(controller.getConfig()).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateConfig', () => {
    it('should save and return config', async () => {
      service.saveConfig.mockResolvedValue(mockConfig as any);
      const result = await controller.updateConfig(mockConfig as any);
      expect(result).toEqual(mockConfig);
      expect(service.saveConfig).toHaveBeenCalledWith(mockConfig);
    });
  });

  describe('testConnection', () => {
    it('should return test result', async () => {
      service.testConnection.mockResolvedValue({ success: true });
      const result = await controller.testConnection();
      expect(result).toEqual({ success: true });
    });
  });

  describe('triggerManually', () => {
    it('should call processEmails and return result', async () => {
      const mockResult = {
        emailsFound: 3,
        attachmentsProcessed: 2,
        rowsIngested: 100,
        errors: [],
        timestamp: new Date().toISOString(),
      };
      service.processEmails.mockResolvedValue(mockResult);
      const result = await controller.triggerManually();
      expect(result).toEqual(mockResult);
    });
  });

  describe('getLogs', () => {
    it('should return logs with default limit', async () => {
      service.getExecutionLogs.mockResolvedValue([]);
      const result = await controller.getLogs();
      expect(result).toEqual([]);
      expect(service.getExecutionLogs).toHaveBeenCalledWith(20);
    });

    it('should parse limit parameter', async () => {
      service.getExecutionLogs.mockResolvedValue([]);
      await controller.getLogs('50');
      expect(service.getExecutionLogs).toHaveBeenCalledWith(50);
    });

    it('should cap limit at 100', async () => {
      service.getExecutionLogs.mockResolvedValue([]);
      await controller.getLogs('200');
      expect(service.getExecutionLogs).toHaveBeenCalledWith(100);
    });

    it('should default to 20 when limit is NaN', async () => {
      service.getExecutionLogs.mockResolvedValue([]);
      await controller.getLogs('abc');
      expect(service.getExecutionLogs).toHaveBeenCalledWith(20);
    });
  });
});
