import { NotFoundException } from '@nestjs/common';
import { ParadasProgramadasService } from './paradas-programadas.service';

const mockRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('ParadasProgramadasService', () => {
  let service: ParadasProgramadasService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ParadasProgramadasService(mockRepository as any);
  });

  describe('create', () => {
    it('should delegate to repository', async () => {
      const dto = { centroTrabalhoId: 'ct1', tipo: 'MANUTENCAO', dataInicio: '2026-03-01', dataFim: '2026-03-02' };
      mockRepository.create.mockResolvedValue({ id: '1', ...dto });
      const result = await service.create(dto as any);
      expect(result.id).toBe('1');
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
      mockRepository.update.mockResolvedValue({ id: '1', motivo: 'Updated' });
      const result = await service.update('1', { motivo: 'Updated' });
      expect(result.motivo).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('should hard-delete when found', async () => {
      mockRepository.findById.mockResolvedValue({ id: '1' });
      mockRepository.delete.mockResolvedValue(undefined);
      await service.remove('1');
      expect(mockRepository.delete).toHaveBeenCalledWith('1');
    });
  });
});
