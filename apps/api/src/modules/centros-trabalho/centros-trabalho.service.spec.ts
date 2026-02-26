import { NotFoundException } from '@nestjs/common';
import { CentrosTrabalhoService } from './centros-trabalho.service';

const mockRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

describe('CentrosTrabalhoService', () => {
  let service: CentrosTrabalhoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CentrosTrabalhoService(mockRepository as any);
  });

  describe('create', () => {
    it('should delegate to repository', async () => {
      const dto = { codigo: 'CT-001', nome: 'Linha 1', tipo: 'PRODUCAO' as any };
      mockRepository.create.mockResolvedValue({ id: '1', ...dto });

      const result = await service.create(dto as any);
      expect(result.codigo).toBe('CT-001');
    });
  });

  describe('findById', () => {
    it('should return when found', async () => {
      mockRepository.findById.mockResolvedValue({ id: '1' });
      const result = await service.findById('1');
      expect(result.id).toBe('1');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(service.findById('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByIdWithCapacity', () => {
    it('should return work center with calculated capacity', async () => {
      mockRepository.findById.mockResolvedValue({
        id: '1',
        capacidadeHoraUnidades: 200,
        eficienciaPercentual: 92,
        turnos: [
          { horaInicio: '06:00', horaFim: '14:00', diasSemana: [1, 2, 3, 4, 5] },
          { horaInicio: '14:00', horaFim: '22:00', diasSemana: [1, 2, 3, 4, 5] },
        ],
      });

      const result = await service.findByIdWithCapacity('1');

      // effective = 200 * 92 / 100 = 184
      expect(result.capacity.effectiveCapacityPerHour).toBe(184);
      // 16 hours per weekday (8 + 8)
      expect(result.capacity.totalShiftHoursPerDay[1]).toBe(16);
      // daily capacity = 16 * 184 = 2944
      expect(result.capacity.dailyCapacity[1]).toBe(2944);
    });
  });

  describe('calculateCapacity', () => {
    it('should handle overnight shifts', () => {
      const centro = {
        capacidadeHoraUnidades: 100,
        eficienciaPercentual: 100,
        turnos: [
          { horaInicio: '22:00', horaFim: '06:00', diasSemana: [1] },
        ],
      };

      const capacity = service.calculateCapacity(centro);

      expect(capacity.totalShiftHoursPerDay[1]).toBe(8);
      expect(capacity.dailyCapacity[1]).toBe(800);
    });

    it('should handle no shifts', () => {
      const centro = {
        capacidadeHoraUnidades: 100,
        eficienciaPercentual: 100,
        turnos: [],
      };

      const capacity = service.calculateCapacity(centro);

      expect(Object.keys(capacity.dailyCapacity)).toHaveLength(0);
    });

    it('should default efficiency to 100%', () => {
      const centro = {
        capacidadeHoraUnidades: 100,
        eficienciaPercentual: null,
        turnos: [],
      };

      const capacity = service.calculateCapacity(centro);
      expect(capacity.effectiveCapacityPerHour).toBe(100);
    });
  });

  describe('update', () => {
    it('should update when found', async () => {
      mockRepository.findById.mockResolvedValue({ id: '1' });
      mockRepository.update.mockResolvedValue({ id: '1', nome: 'Updated' });

      const result = await service.update('1', { nome: 'Updated' });
      expect(result.nome).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('should soft-delete when found', async () => {
      mockRepository.findById.mockResolvedValue({ id: '1' });
      mockRepository.softDelete.mockResolvedValue(undefined);

      await service.remove('1');
      expect(mockRepository.softDelete).toHaveBeenCalledWith('1');
    });
  });
});
