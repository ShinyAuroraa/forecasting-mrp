import { Test, TestingModule } from '@nestjs/testing';
import { ConfigSistemaController } from './config-sistema.controller';
import { ConfigSistemaService } from './config-sistema.service';

describe('ConfigSistemaController', () => {
  let controller: ConfigSistemaController;
  let service: ConfigSistemaService;

  const mockService = {
    getAll: jest.fn(),
    get: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    seedDefaults: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigSistemaController],
      providers: [
        { provide: ConfigSistemaService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<ConfigSistemaController>(ConfigSistemaController);
    service = module.get<ConfigSistemaService>(ConfigSistemaService);
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all config entries', async () => {
      const entries = [
        { id: '1', chave: 'key1', valor: 10, descricao: null },
        { id: '2', chave: 'key2', valor: 'abc', descricao: 'desc' },
      ];
      mockService.getAll.mockResolvedValue(entries);

      const result = await controller.getAll();

      expect(result).toEqual(entries);
      expect(mockService.getAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('get', () => {
    it('should return a single config entry by key', async () => {
      const entry = { id: '1', chave: 'forecast_horizon_weeks', valor: 12, descricao: 'desc' };
      mockService.get.mockResolvedValue(entry);

      const result = await controller.get('forecast_horizon_weeks');

      expect(result).toEqual(entry);
      expect(mockService.get).toHaveBeenCalledWith('forecast_horizon_weeks');
    });
  });

  describe('upsert', () => {
    it('should upsert a config entry with valor and descricao', async () => {
      const updated = { id: '1', chave: 'key1', valor: 42, descricao: 'Updated' };
      mockService.upsert.mockResolvedValue(updated);

      const result = await controller.upsert('key1', { valor: 42, descricao: 'Updated' }, 'user-1');

      expect(result).toEqual(updated);
      expect(mockService.upsert).toHaveBeenCalledWith('key1', 42, 'Updated', 'user-1');
    });

    it('should upsert with valor only (no descricao)', async () => {
      const updated = { id: '1', chave: 'key1', valor: true };
      mockService.upsert.mockResolvedValue(updated);

      const result = await controller.upsert('key1', { valor: true }, 'user-2');

      expect(result).toEqual(updated);
      expect(mockService.upsert).toHaveBeenCalledWith('key1', true, undefined, 'user-2');
    });
  });

  describe('delete', () => {
    it('should delete a config entry by key', async () => {
      mockService.delete.mockResolvedValue(undefined);

      const result = await controller.delete('key1');

      expect(result).toBeUndefined();
      expect(mockService.delete).toHaveBeenCalledWith('key1');
    });
  });

  describe('seedDefaults', () => {
    it('should seed default config entries', async () => {
      const seedResult = { created: 18, skipped: 0 };
      mockService.seedDefaults.mockResolvedValue(seedResult);

      const result = await controller.seedDefaults();

      expect(result).toEqual(seedResult);
      expect(mockService.seedDefaults).toHaveBeenCalledTimes(1);
    });
  });
});
