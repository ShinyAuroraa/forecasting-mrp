import { NotFoundException } from '@nestjs/common';
import { BomController } from './bom.controller';

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  buildTree: jest.fn(),
  calculateExplodedCost: jest.fn(),
};

const mockVersionService = {
  createNewVersion: jest.fn(),
  getVersionHistory: jest.fn(),
  getVersionAt: jest.fn(),
  getCurrentVersion: jest.fn(),
};

describe('BomController', () => {
  let controller: BomController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new BomController(mockService as any, mockVersionService as any);
  });

  describe('POST /bom', () => {
    it('should create a BOM line', async () => {
      const dto = { produtoPaiId: 'p1', produtoFilhoId: 'p2', quantidade: 2 };
      const created = { id: '1', ...dto };
      mockService.create.mockResolvedValue(created);

      const result = await controller.create(dto as any);
      expect(result).toEqual(created);
    });
  });

  describe('GET /bom', () => {
    it('should return paginated BOM lines', async () => {
      const paginated = {
        data: [{ id: '1' }],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({} as any);
      expect(result).toEqual(paginated);
    });
  });

  describe('GET /bom/:id', () => {
    it('should return BOM line by id', async () => {
      const bom = { id: '1', produtoPaiId: 'p1' };
      mockService.findById.mockResolvedValue(bom);

      const result = await controller.findOne('1');
      expect(result).toEqual(bom);
    });

    it('should propagate NotFoundException', async () => {
      mockService.findById.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('GET /bom/tree/:produtoId', () => {
    it('should return BOM tree', async () => {
      const tree = { produtoId: 'p1', children: [] };
      mockService.buildTree.mockResolvedValue(tree);

      const result = await controller.getTree('p1');
      expect(result).toEqual(tree);
    });
  });

  describe('GET /bom/cost/:produtoId', () => {
    it('should return exploded cost', async () => {
      const cost = { produtoId: 'p1', totalCost: 100, components: [] };
      mockService.calculateExplodedCost.mockResolvedValue(cost);

      const result = await controller.getExplodedCost('p1');
      expect(result).toEqual(cost);
    });
  });

  describe('PATCH /bom/:id', () => {
    it('should update BOM line', async () => {
      const updated = { id: '1', quantidade: 5 };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update('1', { quantidade: 5 } as any);
      expect(result).toEqual(updated);
    });
  });

  describe('DELETE /bom/:id', () => {
    it('should soft-delete BOM line', async () => {
      mockService.remove.mockResolvedValue(undefined);

      await controller.remove('1');
      expect(mockService.remove).toHaveBeenCalledWith('1');
    });
  });

  // --- BOM Versioning Endpoint Tests (AC-8, AC-9, AC-10) ---

  describe('POST /bom/versions/:produtoPaiId — AC-8', () => {
    it('should create a new BOM version', async () => {
      const versionResult = { versao: 2, validoDesde: new Date(), lines: [] };
      mockVersionService.createNewVersion.mockResolvedValue(versionResult);

      const result = await controller.createVersion('p1', {});
      expect(result).toEqual(versionResult);
      expect(mockVersionService.createNewVersion).toHaveBeenCalledWith(
        'p1',
        expect.any(Date),
      );
    });

    it('should pass validoDesde from body when provided', async () => {
      const versionResult = { versao: 2, validoDesde: new Date('2026-04-01'), lines: [] };
      mockVersionService.createNewVersion.mockResolvedValue(versionResult);

      await controller.createVersion('p1', { validoDesde: '2026-04-01' });
      expect(mockVersionService.createNewVersion).toHaveBeenCalledWith(
        'p1',
        new Date('2026-04-01'),
      );
    });
  });

  describe('GET /bom/versions/:produtoPaiId — AC-9', () => {
    it('should return version history', async () => {
      const history = [
        { versao: 2, validoDesde: new Date(), validoAte: null, lineCount: 3, createdAt: new Date() },
        { versao: 1, validoDesde: new Date(), validoAte: new Date(), lineCount: 3, createdAt: new Date() },
      ];
      mockVersionService.getVersionHistory.mockResolvedValue(history);

      const result = await controller.getVersionHistory('p1');
      expect(result).toEqual(history);
      expect(result).toHaveLength(2);
    });
  });

  describe('GET /bom/versions/:produtoPaiId/at/:date — AC-10', () => {
    it('should return BOM lines at a specific date', async () => {
      const lines = [
        { id: 'b1', produtoFilhoId: 'p2', quantidade: 3, versao: 1 },
      ];
      mockVersionService.getVersionAt.mockResolvedValue(lines);

      const result = await controller.getVersionAt('p1', '2026-03-01');
      expect(result).toEqual(lines);
      expect(mockVersionService.getVersionAt).toHaveBeenCalledWith(
        'p1',
        new Date('2026-03-01'),
      );
    });
  });

  describe('GET /bom/versions/:produtoPaiId/current', () => {
    it('should return current active version', async () => {
      const current = { versao: 2, lineCount: 3, lines: [] };
      mockVersionService.getCurrentVersion.mockResolvedValue(current);

      const result = await controller.getCurrentVersion('p1');
      expect(result).toEqual(current);
    });
  });
});
