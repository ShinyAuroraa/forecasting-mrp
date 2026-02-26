import { NotFoundException, ConflictException } from '@nestjs/common';
import { ProdutoFornecedorService } from './produto-fornecedor.service';

const mockRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('ProdutoFornecedorService', () => {
  let service: ProdutoFornecedorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProdutoFornecedorService(mockRepository as any);
  });

  describe('create', () => {
    it('should delegate to repository', async () => {
      const dto = { produtoId: 'p1', fornecedorId: 'f1' };
      const created = { id: '1', ...dto };
      mockRepository.create.mockResolvedValue(created);

      const result = await service.create(dto as any);
      expect(result).toEqual(created);
    });

    it('should throw ConflictException on unique constraint violation', async () => {
      mockRepository.create.mockRejectedValue(
        new Error('Unique constraint failed'),
      );

      await expect(
        service.create({ produtoId: 'p1', fornecedorId: 'f1' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should rethrow non-unique-constraint errors', async () => {
      mockRepository.create.mockRejectedValue(new Error('Database error'));

      await expect(
        service.create({ produtoId: 'p1', fornecedorId: 'f1' } as any),
      ).rejects.toThrow('Database error');
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
    it('should return linkage when found', async () => {
      const linkage = { id: '1', produtoId: 'p1' };
      mockRepository.findById.mockResolvedValue(linkage);

      const result = await service.findById('1');
      expect(result).toEqual(linkage);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update when linkage exists', async () => {
      const existing = { id: '1', produtoId: 'p1', fornecedorId: 'f1' };
      const updated = { id: '1', isPrincipal: true };
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockResolvedValue(updated);

      const result = await service.update('1', { isPrincipal: true });
      expect(result).toEqual(updated);
      expect(mockRepository.update).toHaveBeenCalledWith('1', { isPrincipal: true }, 'p1');
    });

    it('should throw NotFoundException on update when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.update('1', { isPrincipal: true })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should hard-delete when linkage exists', async () => {
      mockRepository.findById.mockResolvedValue({ id: '1' });
      mockRepository.delete.mockResolvedValue(undefined);

      await service.remove('1');
      expect(mockRepository.delete).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException on remove when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
