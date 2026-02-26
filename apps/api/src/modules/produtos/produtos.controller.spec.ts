import { NotFoundException } from '@nestjs/common';
import { ProdutosController } from './produtos.controller';

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const mockImportService = {
  processImport: jest.fn(),
};

const mockTemplateService = {
  generateTemplate: jest.fn(),
};

describe('ProdutosController', () => {
  let controller: ProdutosController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProdutosController(
      mockService as any,
      mockImportService as any,
      mockTemplateService as any,
    );
  });

  describe('POST /produtos', () => {
    it('should create a product', async () => {
      const dto = { codigo: 'SKU-001', descricao: 'Produto A', tipoProduto: 'ACABADO' as any };
      const created = { id: '1', ...dto };
      mockService.create.mockResolvedValue(created);

      const result = await controller.create(dto);
      expect(result).toEqual(created);
      expect(mockService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('GET /produtos', () => {
    it('should return paginated products', async () => {
      const paginated = {
        data: [{ id: '1' }],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({} as any);
      expect(result).toEqual(paginated);
    });
  });

  describe('GET /produtos/:id', () => {
    it('should return product by id', async () => {
      const product = { id: '1', codigo: 'SKU-001' };
      mockService.findById.mockResolvedValue(product);

      const result = await controller.findOne('1');
      expect(result).toEqual(product);
    });

    it('should propagate NotFoundException', async () => {
      mockService.findById.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('PATCH /produtos/:id', () => {
    it('should update product', async () => {
      const updated = { id: '1', codigo: 'SKU-002' };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update('1', { codigo: 'SKU-002' });
      expect(result).toEqual(updated);
    });
  });

  describe('DELETE /produtos/:id', () => {
    it('should soft-delete product', async () => {
      mockService.remove.mockResolvedValue(undefined);

      await controller.remove('1');
      expect(mockService.remove).toHaveBeenCalledWith('1');
    });
  });
});
