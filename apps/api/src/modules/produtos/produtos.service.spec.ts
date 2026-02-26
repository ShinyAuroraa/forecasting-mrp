import { NotFoundException } from '@nestjs/common';
import { ProdutosService } from './produtos.service';

const mockRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

describe('ProdutosService', () => {
  let service: ProdutosService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProdutosService(mockRepository as any);
  });

  describe('create', () => {
    it('should delegate to repository', async () => {
      const dto = { codigo: 'SKU-001', descricao: 'Test', tipoProduto: 'ACABADO' as any };
      const created = { id: '1', ...dto };
      mockRepository.create.mockResolvedValue(created);

      const result = await service.create(dto);
      expect(result).toEqual(created);
      expect(mockRepository.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should delegate to repository with filters', async () => {
      const paginated = { data: [], meta: { total: 0 } };
      mockRepository.findAll.mockResolvedValue(paginated);

      const result = await service.findAll({ search: 'test' } as any);
      expect(result).toEqual(paginated);
    });
  });

  describe('findById', () => {
    it('should return product when found', async () => {
      const product = { id: '1', codigo: 'SKU-001' };
      mockRepository.findById.mockResolvedValue(product);

      const result = await service.findById('1');
      expect(result).toEqual(product);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update product when found', async () => {
      const existing = { id: '1', codigo: 'SKU-001' };
      const updated = { id: '1', codigo: 'SKU-002' };
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockResolvedValue(updated);

      const result = await service.update('1', { codigo: 'SKU-002' } as any);
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when product not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { codigo: 'X' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft-delete product when found', async () => {
      const existing = { id: '1', codigo: 'SKU-001' };
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.softDelete.mockResolvedValue(undefined);

      await service.remove('1');
      expect(mockRepository.softDelete).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException when product not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
