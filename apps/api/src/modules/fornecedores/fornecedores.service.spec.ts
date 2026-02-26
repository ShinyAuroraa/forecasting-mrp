import { NotFoundException } from '@nestjs/common';
import { FornecedoresService } from './fornecedores.service';

const mockRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

describe('FornecedoresService', () => {
  let service: FornecedoresService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FornecedoresService(mockRepository as any);
  });

  describe('create', () => {
    it('should delegate to repository', async () => {
      const dto = { codigo: 'SUP-001', razaoSocial: 'Fornecedor A' };
      const created = { id: '1', ...dto };
      mockRepository.create.mockResolvedValue(created);

      const result = await service.create(dto as any);
      expect(result).toEqual(created);
      expect(mockRepository.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should delegate to repository', async () => {
      const paginated = { data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 0, hasNext: false, hasPrev: false } };
      mockRepository.findAll.mockResolvedValue(paginated);

      const result = await service.findAll({} as any);
      expect(result).toEqual(paginated);
    });
  });

  describe('findById', () => {
    it('should return supplier when found', async () => {
      const supplier = { id: '1', codigo: 'SUP-001' };
      mockRepository.findById.mockResolvedValue(supplier);

      const result = await service.findById('1');
      expect(result).toEqual(supplier);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update when supplier exists', async () => {
      const existing = { id: '1', codigo: 'SUP-001' };
      const updated = { id: '1', razaoSocial: 'Updated' };
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockResolvedValue(updated);

      const result = await service.update('1', { razaoSocial: 'Updated' });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException on update when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.update('1', { razaoSocial: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft-delete when supplier exists', async () => {
      mockRepository.findById.mockResolvedValue({ id: '1' });
      mockRepository.softDelete.mockResolvedValue(undefined);

      await service.remove('1');
      expect(mockRepository.softDelete).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException on remove when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
