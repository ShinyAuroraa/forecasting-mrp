import { NotFoundException } from '@nestjs/common';
import { RoteirosController } from './roteiros.controller';

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  findByProdutoId: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('RoteirosController', () => {
  let controller: RoteirosController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new RoteirosController(mockService as any);
  });

  describe('POST /roteiros', () => {
    it('should create a routing', async () => {
      const dto = {
        produtoId: 'prod-1',
        centroTrabalhoId: 'ct-1',
        sequencia: 10,
        operacao: 'Corte',
        tempoUnitarioMinutos: 1.5,
      };
      mockService.create.mockResolvedValue({ id: 'r-1', ...dto });

      const result = await controller.create(dto as any);
      expect(result.id).toBe('r-1');
      expect(result.operacao).toBe('Corte');
      expect(mockService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('GET /roteiros', () => {
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

  describe('GET /roteiros/produto/:produtoId', () => {
    it('should return routings for a product', async () => {
      const roteiros = [
        { id: 'r-1', sequencia: 10 },
        { id: 'r-2', sequencia: 20 },
      ];
      mockService.findByProdutoId.mockResolvedValue(roteiros);

      const result = await controller.findByProdutoId('prod-1');
      expect(result).toHaveLength(2);
      expect(mockService.findByProdutoId).toHaveBeenCalledWith('prod-1');
    });
  });

  describe('GET /roteiros/:id', () => {
    it('should return a single routing', async () => {
      mockService.findById.mockResolvedValue({
        id: 'r-1',
        operacao: 'Corte',
      });

      const result = await controller.findOne('r-1');
      expect(result.id).toBe('r-1');
    });

    it('should propagate NotFoundException', async () => {
      mockService.findById.mockRejectedValue(new NotFoundException());
      await expect(controller.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('PATCH /roteiros/:id', () => {
    it('should update a routing', async () => {
      mockService.update.mockResolvedValue({
        id: 'r-1',
        operacao: 'Solda',
      });

      const result = await controller.update('r-1', {
        operacao: 'Solda',
      } as any);
      expect(result.operacao).toBe('Solda');
      expect(mockService.update).toHaveBeenCalledWith('r-1', {
        operacao: 'Solda',
      });
    });
  });

  describe('DELETE /roteiros/:id', () => {
    it('should soft-delete a routing', async () => {
      mockService.remove.mockResolvedValue(undefined);

      await controller.remove('r-1');
      expect(mockService.remove).toHaveBeenCalledWith('r-1');
    });

    it('should propagate NotFoundException', async () => {
      mockService.remove.mockRejectedValue(new NotFoundException());
      await expect(controller.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
