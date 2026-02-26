import { NotFoundException } from '@nestjs/common';
import { FornecedoresController } from './fornecedores.controller';

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('FornecedoresController', () => {
  let controller: FornecedoresController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new FornecedoresController(mockService as any);
  });

  describe('POST /fornecedores', () => {
    it('should create a supplier', async () => {
      const dto = { codigo: 'SUP-001', razaoSocial: 'Fornecedor A' };
      const created = { id: '1', ...dto };
      mockService.create.mockResolvedValue(created);

      const result = await controller.create(dto as any);
      expect(result).toEqual(created);
      expect(mockService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('GET /fornecedores', () => {
    it('should return paginated suppliers', async () => {
      const paginated = {
        data: [{ id: '1' }],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({} as any);
      expect(result).toEqual(paginated);
    });
  });

  describe('GET /fornecedores/:id', () => {
    it('should return supplier by id', async () => {
      const supplier = { id: '1', codigo: 'SUP-001' };
      mockService.findById.mockResolvedValue(supplier);

      const result = await controller.findOne('1');
      expect(result).toEqual(supplier);
    });

    it('should propagate NotFoundException', async () => {
      mockService.findById.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('PATCH /fornecedores/:id', () => {
    it('should update supplier', async () => {
      const updated = { id: '1', razaoSocial: 'Updated' };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update('1', { razaoSocial: 'Updated' });
      expect(result).toEqual(updated);
    });
  });

  describe('DELETE /fornecedores/:id', () => {
    it('should soft-delete supplier', async () => {
      mockService.remove.mockResolvedValue(undefined);

      await controller.remove('1');
      expect(mockService.remove).toHaveBeenCalledWith('1');
    });
  });
});
