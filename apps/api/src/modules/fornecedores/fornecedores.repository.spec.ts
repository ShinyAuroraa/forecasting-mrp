import { FornecedoresRepository } from './fornecedores.repository';
import { FilterFornecedorDto } from './dto/filter-fornecedor.dto';

const mockPrisma = {
  fornecedor: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

describe('FornecedoresRepository', () => {
  let repository: FornecedoresRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new FornecedoresRepository(mockPrisma as any);
  });

  describe('create', () => {
    it('should create a supplier', async () => {
      const dto = { codigo: 'SUP-001', razaoSocial: 'Fornecedor A' };
      mockPrisma.fornecedor.create.mockResolvedValue({ id: '1', ...dto });

      const result = await repository.create(dto as any);

      expect(mockPrisma.fornecedor.create).toHaveBeenCalledWith({ data: dto });
      expect(result.codigo).toBe('SUP-001');
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      mockPrisma.fornecedor.findMany.mockResolvedValue([{ id: '1' }]);
      mockPrisma.fornecedor.count.mockResolvedValue(1);

      const result = await repository.findAll({} as FilterFornecedorDto);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should apply search filter on codigo, razaoSocial, nomeFantasia', async () => {
      mockPrisma.fornecedor.findMany.mockResolvedValue([]);
      mockPrisma.fornecedor.count.mockResolvedValue(0);

      await repository.findAll({ search: 'test' } as FilterFornecedorDto);

      const callArgs = mockPrisma.fornecedor.findMany.mock.calls[0][0];
      expect(callArgs.where.OR).toEqual([
        { codigo: { contains: 'test', mode: 'insensitive' } },
        { razaoSocial: { contains: 'test', mode: 'insensitive' } },
        { nomeFantasia: { contains: 'test', mode: 'insensitive' } },
      ]);
    });

    it('should apply estado filter', async () => {
      mockPrisma.fornecedor.findMany.mockResolvedValue([]);
      mockPrisma.fornecedor.count.mockResolvedValue(0);

      await repository.findAll({ estado: 'SP' } as FilterFornecedorDto);

      const callArgs = mockPrisma.fornecedor.findMany.mock.calls[0][0];
      expect(callArgs.where.estado).toBe('SP');
    });

    it('should apply ativo filter', async () => {
      mockPrisma.fornecedor.findMany.mockResolvedValue([]);
      mockPrisma.fornecedor.count.mockResolvedValue(0);

      await repository.findAll({ ativo: true } as FilterFornecedorDto);

      const callArgs = mockPrisma.fornecedor.findMany.mock.calls[0][0];
      expect(callArgs.where.ativo).toBe(true);
    });
  });

  describe('findById', () => {
    it('should find by id with produtoFornecedor relations', async () => {
      const supplier = { id: '1', codigo: 'SUP-001', produtoFornecedor: [] };
      mockPrisma.fornecedor.findUnique.mockResolvedValue(supplier);

      const result = await repository.findById('1');

      expect(mockPrisma.fornecedor.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: { produtoFornecedor: { include: { produto: true } } },
      });
      expect(result).toEqual(supplier);
    });

    it('should return null when not found', async () => {
      mockPrisma.fornecedor.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update supplier', async () => {
      const updated = { id: '1', razaoSocial: 'Updated' };
      mockPrisma.fornecedor.update.mockResolvedValue(updated);

      const result = await repository.update('1', { razaoSocial: 'Updated' });

      expect(mockPrisma.fornecedor.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { razaoSocial: 'Updated' },
      });
      expect(result).toEqual(updated);
    });
  });

  describe('softDelete', () => {
    it('should set ativo to false', async () => {
      mockPrisma.fornecedor.update.mockResolvedValue({ id: '1', ativo: false });

      await repository.softDelete('1');

      expect(mockPrisma.fornecedor.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { ativo: false },
      });
    });
  });
});
