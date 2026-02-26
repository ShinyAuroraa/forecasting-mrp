import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AutomationService } from './automation.service';
import type { ErpConfig } from './connectors/erp-connector.interface';

const mockPrisma = {
  configSistema: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockUploadService = {
  processUpload: jest.fn(),
};

const mockTemplateRepository = {
  findById: jest.fn(),
};

const BASE_CONFIG: ErpConfig = {
  tipo: 'REST',
  fallback: 'DB',
  templateId: 'tpl-1',
  rest: {
    url: 'https://erp.example.com/api/movimentacoes',
    auth: { type: 'bearer', token: 'test-token' },
    responseFormat: 'JSON',
    queryParams: { data: '{yesterday}' },
  },
  db: {
    connectionString: 'postgresql://user:pass@localhost:5432/erp',
    query: 'SELECT * FROM movimentacoes WHERE data_movimento = $1',
    maxConnections: 5,
  },
};

describe('AutomationService', () => {
  let service: AutomationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AutomationService(
      mockPrisma as any,
      mockUploadService as any,
      mockTemplateRepository as any,
    );
  });

  describe('getConfig', () => {
    it('should return null when no config exists', async () => {
      mockPrisma.configSistema.findUnique.mockResolvedValue(null);
      const result = await service.getConfig();
      expect(result).toBeNull();
    });

    it('should return parsed config from config_sistema', async () => {
      mockPrisma.configSistema.findUnique.mockResolvedValue({
        chave: 'automacao.erp',
        valor: BASE_CONFIG,
      });
      const result = await service.getConfig();
      expect(result).toEqual(BASE_CONFIG);
      expect(result!.tipo).toBe('REST');
    });
  });

  describe('saveConfig', () => {
    it('should upsert config into config_sistema', async () => {
      mockPrisma.configSistema.upsert.mockResolvedValue({});
      const result = await service.saveConfig(BASE_CONFIG);
      expect(result).toEqual(BASE_CONFIG);
      expect(mockPrisma.configSistema.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { chave: 'automacao.erp' },
          create: expect.objectContaining({ chave: 'automacao.erp' }),
          update: expect.objectContaining({ valor: BASE_CONFIG }),
        }),
      );
    });
  });

  describe('testConnection', () => {
    it('should throw NotFoundException when no config exists', async () => {
      mockPrisma.configSistema.findUnique.mockResolvedValue(null);
      await expect(service.testConnection()).rejects.toThrow(NotFoundException);
    });

    it('should return error when connection fails', async () => {
      mockPrisma.configSistema.findUnique.mockResolvedValue({
        chave: 'automacao.erp',
        valor: {
          tipo: 'REST',
          rest: {
            url: 'http://invalid-host:9999/api',
            auth: { type: 'bearer', token: '' },
            responseFormat: 'JSON',
          },
        },
      });

      const result = await service.testConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('fetchDailyData', () => {
    it('should throw NotFoundException when no config exists', async () => {
      mockPrisma.configSistema.findUnique.mockResolvedValue(null);
      await expect(service.fetchDailyData()).rejects.toThrow(NotFoundException);
    });

    it('should throw when both primary and fallback fail and no fallback configured', async () => {
      mockPrisma.configSistema.findUnique.mockResolvedValue({
        chave: 'automacao.erp',
        valor: {
          tipo: 'REST',
          rest: {
            url: 'http://invalid:9999',
            auth: { type: 'bearer', token: '' },
            responseFormat: 'JSON',
          },
        },
      });

      await expect(service.fetchDailyData()).rejects.toThrow(BadRequestException);
    });
  });
});

describe('ConnectorFactory (via AutomationService integration)', () => {
  it('should throw when REST config is missing', async () => {
    const service = new AutomationService(
      {
        configSistema: {
          findUnique: jest.fn().mockResolvedValue({
            chave: 'automacao.erp',
            valor: { tipo: 'REST' },
          }),
        },
      } as any,
      mockUploadService as any,
      mockTemplateRepository as any,
    );

    const result = await service.testConnection();
    expect(result.success).toBe(false);
    expect(result.error).toContain('REST connector configuration is missing');
  });

  it('should throw when DB config is missing', async () => {
    const service = new AutomationService(
      {
        configSistema: {
          findUnique: jest.fn().mockResolvedValue({
            chave: 'automacao.erp',
            valor: { tipo: 'DB' },
          }),
        },
      } as any,
      mockUploadService as any,
      mockTemplateRepository as any,
    );

    const result = await service.testConnection();
    expect(result.success).toBe(false);
    expect(result.error).toContain('DB connector configuration is missing');
  });

  it('should throw when SFTP config is missing', async () => {
    const service = new AutomationService(
      {
        configSistema: {
          findUnique: jest.fn().mockResolvedValue({
            chave: 'automacao.erp',
            valor: { tipo: 'SFTP' },
          }),
        },
      } as any,
      mockUploadService as any,
      mockTemplateRepository as any,
    );

    const result = await service.testConnection();
    expect(result.success).toBe(false);
    expect(result.error).toContain('SFTP connector configuration is missing');
  });
});
