import { ProdutosRepository } from './produtos.repository';
import { FilterProdutoDto } from './dto/filter-produto.dto';

const mockPrisma = {
  produto: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

describe('ProdutosRepository', () => {
  let repository: ProdutosRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new ProdutosRepository(mockPrisma as any);
  });

  describe('create', () => {
    it('should create a product', async () => {
      const dto = { codigo: 'SKU-001', descricao: 'Produto A', tipoProduto: 'ACABADO' as const };
      mockPrisma.produto.create.mockResolvedValue({ id: '1', ...dto });

      const result = await repository.create(dto as any);

      expect(mockPrisma.produto.create).toHaveBeenCalledWith({ data: dto });
      expect(result.codigo).toBe('SKU-001');
    });
  });

  describe('findAll', () => {
    it('should return paginated results with default params', async () => {
      const products = [{ id: '1', codigo: 'SKU-001' }];
      mockPrisma.produto.findMany.mockResolvedValue(products);
      mockPrisma.produto.count.mockResolvedValue(1);

      const result = await repository.findAll({} as FilterProdutoDto);

      expect(result.data).toEqual(products);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should apply search filter on codigo and descricao', async () => {
      mockPrisma.produto.findMany.mockResolvedValue([]);
      mockPrisma.produto.count.mockResolvedValue(0);

      await repository.findAll({ search: 'test' } as FilterProdutoDto);

      const callArgs = mockPrisma.produto.findMany.mock.calls[0][0];
      expect(callArgs.where.OR).toEqual([
        { codigo: { contains: 'test', mode: 'insensitive' } },
        { descricao: { contains: 'test', mode: 'insensitive' } },
      ]);
    });

    it('should apply tipoProduto filter', async () => {
      mockPrisma.produto.findMany.mockResolvedValue([]);
      mockPrisma.produto.count.mockResolvedValue(0);

      await repository.findAll({ tipoProduto: 'ACABADO' } as FilterProdutoDto);

      const callArgs = mockPrisma.produto.findMany.mock.calls[0][0];
      expect(callArgs.where.tipoProduto).toBe('ACABADO');
    });

    it('should apply categoriaId filter', async () => {
      mockPrisma.produto.findMany.mockResolvedValue([]);
      mockPrisma.produto.count.mockResolvedValue(0);

      await repository.findAll({ categoriaId: 'cat-1' } as FilterProdutoDto);

      const callArgs = mockPrisma.produto.findMany.mock.calls[0][0];
      expect(callArgs.where.categoriaId).toBe('cat-1');
    });

    it('should apply ativo filter', async () => {
      mockPrisma.produto.findMany.mockResolvedValue([]);
      mockPrisma.produto.count.mockResolvedValue(0);

      await repository.findAll({ ativo: true } as FilterProdutoDto);

      const callArgs = mockPrisma.produto.findMany.mock.calls[0][0];
      expect(callArgs.where.ativo).toBe(true);
    });

    it('should apply pagination params', async () => {
      mockPrisma.produto.findMany.mockResolvedValue([]);
      mockPrisma.produto.count.mockResolvedValue(100);

      const result = await repository.findAll({ page: 2, limit: 10 } as FilterProdutoDto);

      const callArgs = mockPrisma.produto.findMany.mock.calls[0][0];
      expect(callArgs.skip).toBe(10);
      expect(callArgs.take).toBe(10);
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
    });
  });

  describe('findById', () => {
    it('should return product with relations', async () => {
      const product = { id: '1', codigo: 'SKU-001', categoria: null, unidadeMedida: null };
      mockPrisma.produto.findUnique.mockResolvedValue(product);

      const result = await repository.findById('1');

      expect(mockPrisma.produto.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: { categoria: true, unidadeMedida: true },
      });
      expect(result).toEqual(product);
    });

    it('should return null when not found', async () => {
      mockPrisma.produto.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update product', async () => {
      const updated = { id: '1', codigo: 'SKU-002' };
      mockPrisma.produto.update.mockResolvedValue(updated);

      const result = await repository.update('1', { codigo: 'SKU-002' } as any);

      expect(mockPrisma.produto.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { codigo: 'SKU-002' },
        include: { categoria: true, unidadeMedida: true },
      });
      expect(result).toEqual(updated);
    });
  });

  describe('softDelete', () => {
    it('should set ativo to false', async () => {
      mockPrisma.produto.update.mockResolvedValue({ id: '1', ativo: false });

      await repository.softDelete('1');

      expect(mockPrisma.produto.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { ativo: false },
      });
    });
  });
});
