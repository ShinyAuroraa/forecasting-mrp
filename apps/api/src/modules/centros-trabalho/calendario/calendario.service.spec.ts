import { NotFoundException } from '@nestjs/common';
import { CalendarioService } from './calendario.service';

const mockRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  bulkCreate: jest.fn(),
  countWorkingDays: jest.fn(),
};

describe('CalendarioService', () => {
  let service: CalendarioService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CalendarioService(mockRepository as any);
  });

  describe('create', () => {
    it('should delegate to repository', async () => {
      const dto = {
        data: '2026-01-15',
        tipo: 'UTIL',
        horasProdutivas: 8,
      };
      mockRepository.create.mockResolvedValue({ id: 'c-1', ...dto });

      const result = await service.create(dto as any);
      expect(result.id).toBe('c-1');
      expect(result.tipo).toBe('UTIL');
    });
  });

  describe('findAll', () => {
    it('should delegate to repository', async () => {
      const paginated = {
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
      mockRepository.findAll.mockResolvedValue(paginated);

      const result = await service.findAll({} as any);
      expect(result).toEqual(paginated);
    });
  });

  describe('findById', () => {
    it('should return calendar entry when found', async () => {
      mockRepository.findById.mockResolvedValue({
        id: 'c-1',
        tipo: 'FERIADO',
      });

      const result = await service.findById('c-1');
      expect(result.id).toBe('c-1');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update when found', async () => {
      mockRepository.findById.mockResolvedValue({ id: 'c-1' });
      mockRepository.update.mockResolvedValue({
        id: 'c-1',
        tipo: 'FERIADO',
        descricao: 'Natal',
      });

      const result = await service.update('c-1', {
        tipo: 'FERIADO',
        descricao: 'Natal',
      } as any);
      expect(result.descricao).toBe('Natal');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { tipo: 'FERIADO' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should hard-delete when found', async () => {
      mockRepository.findById.mockResolvedValue({ id: 'c-1' });
      mockRepository.delete.mockResolvedValue(undefined);

      await service.remove('c-1');
      expect(mockRepository.delete).toHaveBeenCalledWith('c-1');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('bulkCreate', () => {
    it('should return created and skipped counts', async () => {
      const entries = [
        { data: '2026-01-01', tipo: 'FERIADO', horasProdutivas: 0 },
        { data: '2026-01-02', tipo: 'UTIL', horasProdutivas: 8 },
        { data: '2026-01-03', tipo: 'SABADO', horasProdutivas: 0 },
      ];
      mockRepository.bulkCreate.mockResolvedValue({ count: 2 });

      const result = await service.bulkCreate(entries as any);
      expect(result.created).toBe(2);
      expect(result.skipped).toBe(1);
    });

    it('should return zero skipped when all are created', async () => {
      const entries = [
        { data: '2026-03-01', tipo: 'UTIL', horasProdutivas: 8 },
      ];
      mockRepository.bulkCreate.mockResolvedValue({ count: 1 });

      const result = await service.bulkCreate(entries as any);
      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);
    });
  });

  describe('countWorkingDays', () => {
    it('should return count from repository', async () => {
      mockRepository.countWorkingDays.mockResolvedValue(22);

      const result = await service.countWorkingDays(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );
      expect(result).toBe(22);
      expect(mockRepository.countWorkingDays).toHaveBeenCalledWith(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );
    });

    it('should return zero when no working days in range', async () => {
      mockRepository.countWorkingDays.mockResolvedValue(0);

      const result = await service.countWorkingDays(
        new Date('2026-12-25'),
        new Date('2026-12-25'),
      );
      expect(result).toBe(0);
    });
  });
});
