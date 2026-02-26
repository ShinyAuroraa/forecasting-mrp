import { BomRepository } from './bom.repository';
import { FilterBomDto } from './dto/filter-bom.dto';

const mockPrisma = {
  bom: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

describe('BomRepository', () => {
  let repository: BomRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new BomRepository(mockPrisma as any);
  });

  describe('create', () => {
    it('should create a BOM line with relations', async () => {
      const dto = { produtoPaiId: 'p1', produtoFilhoId: 'p2', quantidade: 2 };
      const created = { id: '1', ...dto };
      mockPrisma.bom.create.mockResolvedValue(created);

      const result = await repository.create(dto as any);

      expect(mockPrisma.bom.create).toHaveBeenCalledWith({
        data: dto,
        include: { produtoPai: true, produtoFilho: true, unidadeMedida: true },
      });
      expect(result.id).toBe('1');
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      mockPrisma.bom.findMany.mockResolvedValue([{ id: '1' }]);
      mockPrisma.bom.count.mockResolvedValue(1);

      const result = await repository.findAll({} as FilterBomDto);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by produtoPaiId', async () => {
      mockPrisma.bom.findMany.mockResolvedValue([]);
      mockPrisma.bom.count.mockResolvedValue(0);

      await repository.findAll({ produtoPaiId: 'p1' } as FilterBomDto);

      const callArgs = mockPrisma.bom.findMany.mock.calls[0][0];
      expect(callArgs.where.produtoPaiId).toBe('p1');
    });

    it('should filter by ativo', async () => {
      mockPrisma.bom.findMany.mockResolvedValue([]);
      mockPrisma.bom.count.mockResolvedValue(0);

      await repository.findAll({ ativo: true } as FilterBomDto);

      const callArgs = mockPrisma.bom.findMany.mock.calls[0][0];
      expect(callArgs.where.ativo).toBe(true);
    });
  });

  describe('findById', () => {
    it('should find by id with relations', async () => {
      const bom = { id: '1', produtoPaiId: 'p1' };
      mockPrisma.bom.findUnique.mockResolvedValue(bom);

      const result = await repository.findById('1');

      expect(result).toEqual(bom);
    });
  });

  describe('findByProdutoPaiId', () => {
    it('should find active BOM lines for a parent', async () => {
      const bomLines = [{ id: '1', produtoPaiId: 'p1', ativo: true }];
      mockPrisma.bom.findMany.mockResolvedValue(bomLines);

      const result = await repository.findByProdutoPaiId('p1');

      expect(mockPrisma.bom.findMany).toHaveBeenCalledWith({
        where: { produtoPaiId: 'p1', ativo: true },
        include: { produtoFilho: true, unidadeMedida: true },
      });
      expect(result).toEqual(bomLines);
    });
  });

  describe('softDelete', () => {
    it('should set ativo to false', async () => {
      mockPrisma.bom.update.mockResolvedValue({ id: '1', ativo: false });

      await repository.softDelete('1');

      expect(mockPrisma.bom.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { ativo: false },
      });
    });
  });
});
