import { ProdutoFornecedorRepository } from './produto-fornecedor.repository';
import { FilterProdutoFornecedorDto } from './dto/filter-produto-fornecedor.dto';

const mockTx = {
  produtoFornecedor: {
    create: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
};

const mockPrisma = {
  $transaction: jest.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  produtoFornecedor: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
};

describe('ProdutoFornecedorRepository', () => {
  let repository: ProdutoFornecedorRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new ProdutoFornecedorRepository(mockPrisma as any);
  });

  describe('create', () => {
    it('should create a linkage', async () => {
      const dto = { produtoId: 'p1', fornecedorId: 'f1' };
      const created = { id: '1', ...dto };
      mockTx.produtoFornecedor.create.mockResolvedValue(created);

      const result = await repository.create(dto as any);

      expect(result).toEqual(created);
    });

    it('should unset existing isPrincipal when creating with isPrincipal=true', async () => {
      const dto = { produtoId: 'p1', fornecedorId: 'f1', isPrincipal: true };
      mockTx.produtoFornecedor.updateMany.mockResolvedValue({ count: 1 });
      mockTx.produtoFornecedor.create.mockResolvedValue({ id: '1', ...dto });

      await repository.create(dto as any);

      expect(mockTx.produtoFornecedor.updateMany).toHaveBeenCalledWith({
        where: { produtoId: 'p1', isPrincipal: true },
        data: { isPrincipal: false },
      });
    });

    it('should not unset isPrincipal when creating with isPrincipal=false', async () => {
      const dto = { produtoId: 'p1', fornecedorId: 'f1', isPrincipal: false };
      mockTx.produtoFornecedor.create.mockResolvedValue({ id: '1', ...dto });

      await repository.create(dto as any);

      expect(mockTx.produtoFornecedor.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      mockPrisma.produtoFornecedor.findMany.mockResolvedValue([{ id: '1' }]);
      mockPrisma.produtoFornecedor.count.mockResolvedValue(1);

      const result = await repository.findAll({} as FilterProdutoFornecedorDto);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by produtoId', async () => {
      mockPrisma.produtoFornecedor.findMany.mockResolvedValue([]);
      mockPrisma.produtoFornecedor.count.mockResolvedValue(0);

      await repository.findAll({ produtoId: 'p1' } as FilterProdutoFornecedorDto);

      const callArgs = mockPrisma.produtoFornecedor.findMany.mock.calls[0][0];
      expect(callArgs.where.produtoId).toBe('p1');
    });

    it('should filter by fornecedorId', async () => {
      mockPrisma.produtoFornecedor.findMany.mockResolvedValue([]);
      mockPrisma.produtoFornecedor.count.mockResolvedValue(0);

      await repository.findAll({ fornecedorId: 'f1' } as FilterProdutoFornecedorDto);

      const callArgs = mockPrisma.produtoFornecedor.findMany.mock.calls[0][0];
      expect(callArgs.where.fornecedorId).toBe('f1');
    });
  });

  describe('findById', () => {
    it('should find by id with relations', async () => {
      const linkage = { id: '1', produtoId: 'p1', fornecedorId: 'f1' };
      mockPrisma.produtoFornecedor.findUnique.mockResolvedValue(linkage);

      const result = await repository.findById('1');

      expect(result).toEqual(linkage);
      expect(mockPrisma.produtoFornecedor.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: { produto: true, fornecedor: true },
      });
    });
  });

  describe('update', () => {
    it('should unset existing isPrincipal when updating with isPrincipal=true', async () => {
      const dto = { isPrincipal: true };
      mockTx.produtoFornecedor.updateMany.mockResolvedValue({ count: 1 });
      mockTx.produtoFornecedor.update.mockResolvedValue({ id: '1', ...dto });

      await repository.update('1', dto, 'p1');

      expect(mockTx.produtoFornecedor.updateMany).toHaveBeenCalledWith({
        where: { produtoId: 'p1', isPrincipal: true, id: { not: '1' } },
        data: { isPrincipal: false },
      });
    });
  });

  describe('delete', () => {
    it('should hard delete linkage', async () => {
      mockPrisma.produtoFornecedor.delete.mockResolvedValue({ id: '1' });

      await repository.delete('1');

      expect(mockPrisma.produtoFornecedor.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });
});
