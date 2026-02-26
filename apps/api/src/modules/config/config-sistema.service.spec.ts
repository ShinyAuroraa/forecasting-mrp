import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigSistemaService, CONFIG_DEFAULTS } from './config-sistema.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ConfigSistemaService', () => {
  let service: ConfigSistemaService;

  const mockConfigSistema = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    delete: jest.fn(),
  };

  const mockPrisma = {
    configSistema: mockConfigSistema,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigSistemaService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ConfigSistemaService>(ConfigSistemaService);
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all config entries ordered by chave', async () => {
      const mockEntries = [
        { id: '1', chave: 'a_key', valor: 10, descricao: 'desc A', updatedBy: null, updatedAt: new Date() },
        { id: '2', chave: 'b_key', valor: 20, descricao: 'desc B', updatedBy: null, updatedAt: new Date() },
      ];
      mockConfigSistema.findMany.mockResolvedValue(mockEntries);

      const result = await service.getAll();

      expect(result).toEqual(mockEntries);
      expect(mockConfigSistema.findMany).toHaveBeenCalledWith({
        orderBy: { chave: 'asc' },
      });
    });

    it('should return empty array when no entries exist', async () => {
      mockConfigSistema.findMany.mockResolvedValue([]);

      const result = await service.getAll();

      expect(result).toEqual([]);
    });
  });

  describe('get', () => {
    it('should return a config entry by key', async () => {
      const mockEntry = { id: '1', chave: 'forecast_horizon_weeks', valor: 12, descricao: 'desc', updatedBy: null, updatedAt: new Date() };
      mockConfigSistema.findUnique.mockResolvedValue(mockEntry);

      const result = await service.get('forecast_horizon_weeks');

      expect(result).toEqual(mockEntry);
      expect(mockConfigSistema.findUnique).toHaveBeenCalledWith({
        where: { chave: 'forecast_horizon_weeks' },
      });
    });

    it('should throw NotFoundException for non-existent key', async () => {
      mockConfigSistema.findUnique.mockResolvedValue(null);

      await expect(service.get('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTyped', () => {
    it('should return database value when entry exists', async () => {
      mockConfigSistema.findUnique.mockResolvedValue({
        id: '1', chave: 'forecast_horizon_weeks', valor: 24, descricao: null, updatedBy: null, updatedAt: new Date(),
      });

      const result = await service.getTyped('forecast_horizon_weeks');

      expect(result).toBe(24);
    });

    it('should return default value when key not in database', async () => {
      mockConfigSistema.findUnique.mockResolvedValue(null);

      const result = await service.getTyped('forecast_horizon_weeks');

      expect(result).toBe(12);
    });

    it('should return correct default for boolean config', async () => {
      mockConfigSistema.findUnique.mockResolvedValue(null);

      const result = await service.getTyped('mrp_include_crp');

      expect(result).toBe(true);
    });

    it('should return correct default for string config', async () => {
      mockConfigSistema.findUnique.mockResolvedValue(null);

      const result = await service.getTyped('lot_sizing_method');

      expect(result).toBe('L4L');
    });
  });

  describe('upsert', () => {
    it('should upsert a config entry with all fields', async () => {
      const upsertResult = { id: '1', chave: 'forecast_horizon_weeks', valor: 24, descricao: 'Updated desc', updatedBy: 'user-1', updatedAt: new Date() };
      mockConfigSistema.upsert.mockResolvedValue(upsertResult);

      const result = await service.upsert('forecast_horizon_weeks', 24, 'Updated desc', 'user-1');

      expect(result).toEqual(upsertResult);
      expect(mockConfigSistema.upsert).toHaveBeenCalledWith({
        where: { chave: 'forecast_horizon_weeks' },
        create: {
          chave: 'forecast_horizon_weeks',
          valor: 24,
          descricao: 'Updated desc',
          updatedBy: 'user-1',
        },
        update: {
          valor: 24,
          descricao: 'Updated desc',
          updatedBy: 'user-1',
        },
      });
    });

    it('should handle upsert without optional fields', async () => {
      mockConfigSistema.upsert.mockResolvedValue({ id: '1', chave: 'test', valor: true });

      await service.upsert('test', true);

      expect(mockConfigSistema.upsert).toHaveBeenCalledWith({
        where: { chave: 'test' },
        create: {
          chave: 'test',
          valor: true,
          descricao: null,
          updatedBy: null,
        },
        update: {
          valor: true,
          descricao: undefined,
          updatedBy: undefined,
        },
      });
    });
  });

  describe('delete', () => {
    it('should delete an existing config entry', async () => {
      const existing = { id: '1', chave: 'test_key', valor: 42 };
      mockConfigSistema.findUnique.mockResolvedValue(existing);
      mockConfigSistema.delete.mockResolvedValue(existing);

      const result = await service.delete('test_key');

      expect(result).toEqual(existing);
      expect(mockConfigSistema.delete).toHaveBeenCalledWith({
        where: { chave: 'test_key' },
      });
    });

    it('should throw NotFoundException when deleting non-existent key', async () => {
      mockConfigSistema.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
      expect(mockConfigSistema.delete).not.toHaveBeenCalled();
    });
  });

  describe('seedDefaults', () => {
    it('should create all entries when database is empty', async () => {
      const defaultCount = Object.keys(CONFIG_DEFAULTS).length;
      mockConfigSistema.createMany.mockResolvedValue({ count: defaultCount });

      const result = await service.seedDefaults();

      expect(result.created).toBe(defaultCount);
      expect(result.skipped).toBe(0);
      expect(mockConfigSistema.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ chave: 'forecast_horizon_weeks', valor: 12 }),
        ]),
        skipDuplicates: true,
      });
    });

    it('should report skipped entries when all exist', async () => {
      mockConfigSistema.createMany.mockResolvedValue({ count: 0 });

      const result = await service.seedDefaults();

      const defaultCount = Object.keys(CONFIG_DEFAULTS).length;
      expect(result.created).toBe(0);
      expect(result.skipped).toBe(defaultCount);
    });

    it('should include correct values for known keys in createMany data', async () => {
      const defaultCount = Object.keys(CONFIG_DEFAULTS).length;
      mockConfigSistema.createMany.mockResolvedValue({ count: defaultCount });

      await service.seedDefaults();

      const callData = mockConfigSistema.createMany.mock.calls[0][0].data;
      const forecastEntry = callData.find((d: any) => d.chave === 'forecast_horizon_weeks');
      expect(forecastEntry).toBeDefined();
      expect(forecastEntry.valor).toBe(12);
      expect(forecastEntry.descricao).toBe('Horizonte de forecast em semanas');
    });
  });
});
