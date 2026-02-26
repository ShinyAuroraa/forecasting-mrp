import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BomService } from './bom.service';

const mockRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  findByProdutoPaiId: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

describe('BomService', () => {
  let service: BomService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BomService(mockRepository as any);
  });

  describe('create', () => {
    it('should create a BOM line', async () => {
      const dto = { produtoPaiId: 'p1', produtoFilhoId: 'p2', quantidade: 2 };
      const created = { id: '1', ...dto };
      mockRepository.findByProdutoPaiId.mockResolvedValue([]);
      mockRepository.create.mockResolvedValue(created);

      const result = await service.create(dto as any);
      expect(result).toEqual(created);
    });

    it('should reject self-referencing BOM', async () => {
      const dto = { produtoPaiId: 'p1', produtoFilhoId: 'p1', quantidade: 1 };

      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should detect circular reference', async () => {
      // p1 -> p2 (existing), trying to add p2 -> p1 (would create cycle)
      // When checking if p1 is an ancestor of p2: findByProdutoPaiId('p1') returns p2 line
      mockRepository.findByProdutoPaiId.mockImplementation(
        async (parentId: string) => {
          if (parentId === 'p1') {
            return [
              {
                id: 'bom1',
                produtoPaiId: 'p1',
                produtoFilhoId: 'p2',
                quantidade: 1,
                perdaPercentual: 0,
                produtoFilho: { id: 'p2', codigo: 'P2', descricao: 'Product 2' },
              },
            ];
          }
          return [];
        },
      );

      const dto = { produtoPaiId: 'p2', produtoFilhoId: 'p1', quantidade: 1 };

      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findById', () => {
    it('should return BOM line when found', async () => {
      const bom = { id: '1' };
      mockRepository.findById.mockResolvedValue(bom);

      const result = await service.findById('1');
      expect(result).toEqual(bom);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update when BOM exists', async () => {
      mockRepository.findById.mockResolvedValue({ id: '1' });
      mockRepository.update.mockResolvedValue({ id: '1', quantidade: 5 });

      const result = await service.update('1', { quantidade: 5 } as any);
      expect(result.quantidade).toBe(5);
    });
  });

  describe('remove', () => {
    it('should soft-delete when BOM exists', async () => {
      mockRepository.findById.mockResolvedValue({ id: '1' });
      mockRepository.softDelete.mockResolvedValue(undefined);

      await service.remove('1');
      expect(mockRepository.softDelete).toHaveBeenCalledWith('1');
    });
  });

  describe('buildTree', () => {
    it('should return empty children for leaf product', async () => {
      mockRepository.findByProdutoPaiId.mockResolvedValue([]);

      const tree = await service.buildTree('leaf-id');

      expect(tree.produtoId).toBe('leaf-id');
      expect(tree.children).toHaveLength(0);
    });

    it('should build multi-level tree', async () => {
      // p1 -> p2 -> p3
      mockRepository.findByProdutoPaiId.mockImplementation(
        async (parentId: string) => {
          if (parentId === 'p1') {
            return [
              {
                id: 'bom1',
                quantidade: 2,
                perdaPercentual: 0,
                produtoPai: { codigo: 'P1', descricao: 'Product 1' },
                produtoFilho: {
                  id: 'p2',
                  codigo: 'P2',
                  descricao: 'Product 2',
                  custoUnitario: 10,
                },
              },
            ];
          }
          if (parentId === 'p2') {
            return [
              {
                id: 'bom2',
                quantidade: 3,
                perdaPercentual: 5,
                produtoPai: { codigo: 'P2', descricao: 'Product 2' },
                produtoFilho: {
                  id: 'p3',
                  codigo: 'P3',
                  descricao: 'Product 3',
                  custoUnitario: 5,
                },
              },
            ];
          }
          return [];
        },
      );

      const tree = await service.buildTree('p1');

      expect(tree.codigo).toBe('P1');
      expect(tree.children).toHaveLength(1);
      expect(tree.children[0].codigo).toBe('P2');
      expect(tree.children[0].quantidade).toBe(2);
      expect(tree.children[0].children).toHaveLength(1);
      expect(tree.children[0].children[0].codigo).toBe('P3');
    });
  });

  describe('calculateExplodedCost', () => {
    it('should return zero cost for product with no BOM', async () => {
      mockRepository.findByProdutoPaiId.mockResolvedValue([]);

      const result = await service.calculateExplodedCost('p1');

      expect(result.totalCost).toBe(0);
      expect(result.components).toHaveLength(0);
    });

    it('should calculate single-level exploded cost with loss', async () => {
      mockRepository.findByProdutoPaiId.mockImplementation(
        async (parentId: string) => {
          if (parentId === 'p1') {
            return [
              {
                id: 'bom1',
                quantidade: 2,
                perdaPercentual: 10,
                produtoPai: { codigo: 'P1', descricao: 'Product 1' },
                produtoFilho: {
                  id: 'p2',
                  codigo: 'P2',
                  descricao: 'Component',
                  custoUnitario: 100,
                },
              },
            ];
          }
          return [];
        },
      );

      const result = await service.calculateExplodedCost('p1');

      // lineCost = 100 * 2 * (1 + 10/100) = 100 * 2 * 1.1 = 220
      expect(result.totalCost).toBe(220);
      expect(result.components).toHaveLength(1);
      expect(result.components[0].lineCost).toBe(220);
      expect(result.components[0].level).toBe(1);
    });

    it('should calculate multi-level exploded cost', async () => {
      // p1 -> p2 (qty=2, loss=0%) -> p3 (qty=3, loss=5%)
      // p2 cost = 10, p3 cost = 5
      mockRepository.findByProdutoPaiId.mockImplementation(
        async (parentId: string) => {
          if (parentId === 'p1') {
            return [
              {
                id: 'bom1',
                quantidade: 2,
                perdaPercentual: 0,
                produtoPai: { codigo: 'P1', descricao: 'Product 1' },
                produtoFilho: {
                  id: 'p2',
                  codigo: 'P2',
                  descricao: 'Sub-assy',
                  custoUnitario: 10,
                },
              },
            ];
          }
          if (parentId === 'p2') {
            return [
              {
                id: 'bom2',
                quantidade: 3,
                perdaPercentual: 5,
                produtoPai: { codigo: 'P2', descricao: 'Sub-assy' },
                produtoFilho: {
                  id: 'p3',
                  codigo: 'P3',
                  descricao: 'Raw material',
                  custoUnitario: 5,
                },
              },
            ];
          }
          return [];
        },
      );

      const result = await service.calculateExplodedCost('p1');

      // Level 1: p2 cost = 10 * 2 * 1.0 = 20
      // Level 2: p3 cost = 5 * (3*2) * 1.05 = 5 * 6 * 1.05 = 31.50
      // Total = 20 + 31.50 = 51.50
      expect(result.totalCost).toBe(51.5);
      expect(result.components).toHaveLength(2);
      expect(result.components[0].lineCost).toBe(20);
      expect(result.components[1].lineCost).toBe(31.5);
    });
  });
});
