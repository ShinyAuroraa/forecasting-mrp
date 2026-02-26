import { NotFoundException } from '@nestjs/common';
import { TurnosService } from './turnos.service';

const mockRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

describe('TurnosService', () => {
  let service: TurnosService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TurnosService(mockRepository as any);
  });

  describe('create', () => {
    it('should delegate to repository', async () => {
      const dto = { centroTrabalhoId: 'ct1', nome: 'Turno 1', horaInicio: '06:00', horaFim: '14:00', diasSemana: [1, 2, 3, 4, 5] };
      mockRepository.create.mockResolvedValue({ id: '1', ...dto });

      const result = await service.create(dto as any);
      expect(result.nome).toBe('Turno 1');
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
