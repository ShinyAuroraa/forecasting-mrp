import { NotFoundException } from '@nestjs/common';
import { ProdutoFornecedorController } from './produto-fornecedor.controller';

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('ProdutoFornecedorController', () => {
  let controller: ProdutoFornecedorController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProdutoFornecedorController(mockService as any);
  });

  describe('POST /produto-fornecedor', () => {
    it('should create a linkage', async () => {
      const dto = { produtoId: 'p1', fornecedorId: 'f1' };
      const created = { id: '1', ...dto };
      mockService.create.mockResolvedValue(created);

      const result = await controller.create(dto as any);
      expect(result).toEqual(created);
    });
  });

  describe('GET /produto-fornecedor', () => {
    it('should return paginated linkages', async () => {
      const paginated = {
        data: [{ id: '1' }],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({} as any);
      expect(result).toEqual(paginated);
    });
  });

  describe('GET /produto-fornecedor/:id', () => {
    it('should return linkage by id', async () => {
      const linkage = { id: '1', produtoId: 'p1' };
      mockService.findById.mockResolvedValue(linkage);

      const result = await controller.findOne('1');
      expect(result).toEqual(linkage);
    });

    it('should propagate NotFoundException', async () => {
      mockService.findById.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('PATCH /produto-fornecedor/:id', () => {
    it('should update linkage', async () => {
      const updated = { id: '1', isPrincipal: true };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update('1', { isPrincipal: true });
      expect(result).toEqual(updated);
    });
  });

  describe('DELETE /produto-fornecedor/:id', () => {
    it('should delete linkage', async () => {
      mockService.remove.mockResolvedValue(undefined);

      await controller.remove('1');
      expect(mockService.remove).toHaveBeenCalledWith('1');
    });
  });
});
