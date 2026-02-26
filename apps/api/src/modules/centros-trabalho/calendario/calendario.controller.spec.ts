import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CalendarioController } from './calendario.controller';

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  bulkCreate: jest.fn(),
  countWorkingDays: jest.fn(),
};

describe('CalendarioController', () => {
  let controller: CalendarioController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new CalendarioController(mockService as any);
  });

  describe('POST /calendario', () => {
    it('should create a calendar entry', async () => {
      const dto = {
        data: '2026-01-15',
        tipo: 'UTIL',
        horasProdutivas: 8,
      };
      mockService.create.mockResolvedValue({ id: 'c-1', ...dto });

      const result = await controller.create(dto as any);
      expect(result.id).toBe('c-1');
      expect(result.tipo).toBe('UTIL');
    });
  });

  describe('POST /calendario/bulk', () => {
    it('should bulk create calendar entries', async () => {
      const entries = [
        { data: '2026-01-01', tipo: 'FERIADO', horasProdutivas: 0 },
        { data: '2026-01-02', tipo: 'UTIL', horasProdutivas: 8 },
      ];
      mockService.bulkCreate.mockResolvedValue({ created: 2, skipped: 0 });

      const result = await controller.bulkCreate(entries as any);
      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
    });

    it('should throw BadRequestException for empty array', () => {
      expect(() => controller.bulkCreate([])).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for non-array body', () => {
      expect(() => controller.bulkCreate(null as any)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('GET /calendario', () => {
    it('should return paginated results', async () => {
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
      mockService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({} as any);
      expect(result).toEqual(paginated);
    });
  });

  describe('GET /calendario/working-days', () => {
    it('should return working days count', async () => {
      mockService.countWorkingDays.mockResolvedValue(22);

      const result = await controller.countWorkingDays(
        '2026-01-01',
        '2026-01-31',
      );
      expect(result.workingDays).toBe(22);
      expect(result.start).toBe('2026-01-01');
      expect(result.end).toBe('2026-01-31');
    });

    it('should throw BadRequestException when start is missing', () => {
      expect(() => controller.countWorkingDays('', '2026-01-31')).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when end is missing', () => {
      expect(() => controller.countWorkingDays('2026-01-01', '')).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid date format', () => {
      expect(() =>
        controller.countWorkingDays('invalid', '2026-01-31'),
      ).toThrow(BadRequestException);
    });
  });

  describe('GET /calendario/:id', () => {
    it('should return a single calendar entry', async () => {
      mockService.findById.mockResolvedValue({
        id: 'c-1',
        tipo: 'FERIADO',
      });

      const result = await controller.findOne('c-1');
      expect(result.id).toBe('c-1');
    });

    it('should propagate NotFoundException', async () => {
      mockService.findById.mockRejectedValue(new NotFoundException());
      await expect(controller.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('PATCH /calendario/:id', () => {
    it('should update a calendar entry', async () => {
      mockService.update.mockResolvedValue({
        id: 'c-1',
        descricao: 'Carnaval',
      });

      const result = await controller.update('c-1', {
        descricao: 'Carnaval',
      } as any);
      expect(result.descricao).toBe('Carnaval');
    });
  });

  describe('DELETE /calendario/:id', () => {
    it('should hard-delete a calendar entry', async () => {
      mockService.remove.mockResolvedValue(undefined);

      await controller.remove('c-1');
      expect(mockService.remove).toHaveBeenCalledWith('c-1');
    });

    it('should propagate NotFoundException', async () => {
      mockService.remove.mockRejectedValue(new NotFoundException());
      await expect(controller.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
