import { MappingTemplateRepository } from './mapping-template.repository';

const mockTemplate = {
  id: 'tpl-1',
  nome: 'Vendas SAP',
  descricao: null,
  tipoFonte: 'CSV',
  colunas: [
    { sourceColumn: 'sku', targetField: 'codigo', dataType: 'string', required: true },
    { sourceColumn: 'date', targetField: 'dataReferencia', dataType: 'date', required: true },
    { sourceColumn: 'qty', targetField: 'volume', dataType: 'number', required: false },
  ],
  validationRules: null,
  lastUsedAt: null,
  usageCount: 5,
  ativo: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  mappingTemplate: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('MappingTemplateRepository', () => {
  let repository: MappingTemplateRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new MappingTemplateRepository(mockPrisma as any);
  });

  describe('create', () => {
    it('should create a template via Prisma', async () => {
      mockPrisma.mappingTemplate.create.mockResolvedValue(mockTemplate);
      const result = await repository.create({
        nome: 'Vendas SAP',
        tipoFonte: 'CSV',
        colunas: mockTemplate.colunas as any,
      } as any);
      expect(result.nome).toBe('Vendas SAP');
      expect(mockPrisma.mappingTemplate.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('should return paginated results with default filters', async () => {
      mockPrisma.mappingTemplate.findMany.mockResolvedValue([mockTemplate]);
      mockPrisma.mappingTemplate.count.mockResolvedValue(1);
      const result = await repository.findAll({ page: 1, limit: 50 } as any);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by search text', async () => {
      mockPrisma.mappingTemplate.findMany.mockResolvedValue([]);
      mockPrisma.mappingTemplate.count.mockResolvedValue(0);
      await repository.findAll({ search: 'SAP', page: 1, limit: 50 } as any);
      const callArg = mockPrisma.mappingTemplate.findMany.mock.calls[0][0];
      expect(callArg.where.OR).toBeDefined();
    });

    it('should filter by tipoFonte', async () => {
      mockPrisma.mappingTemplate.findMany.mockResolvedValue([]);
      mockPrisma.mappingTemplate.count.mockResolvedValue(0);
      await repository.findAll({
        tipoFonte: 'XLSX',
        page: 1,
        limit: 50,
      } as any);
      const callArg = mockPrisma.mappingTemplate.findMany.mock.calls[0][0];
      expect(callArg.where.tipoFonte).toBe('XLSX');
    });
  });

  describe('findById', () => {
    it('should find template by id', async () => {
      mockPrisma.mappingTemplate.findFirst.mockResolvedValue(mockTemplate);
      const result = await repository.findById('tpl-1');
      expect(result?.id).toBe('tpl-1');
    });

    it('should return null when not found', async () => {
      mockPrisma.mappingTemplate.findFirst.mockResolvedValue(null);
      const result = await repository.findById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update template fields', async () => {
      const updated = { ...mockTemplate, nome: 'Updated' };
      mockPrisma.mappingTemplate.update.mockResolvedValue(updated);
      const result = await repository.update('tpl-1', { nome: 'Updated' });
      expect(result.nome).toBe('Updated');
    });
  });

  describe('delete', () => {
    it('should soft-delete by setting ativo=false', async () => {
      mockPrisma.mappingTemplate.update.mockResolvedValue({
        ...mockTemplate,
        ativo: false,
      });
      const result = await repository.delete('tpl-1');
      expect(result.ativo).toBe(false);
      expect(mockPrisma.mappingTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tpl-1' },
        data: { ativo: false },
      });
    });
  });

  describe('duplicate', () => {
    it('should create a copy with "(cópia)" suffix', async () => {
      mockPrisma.mappingTemplate.findFirst.mockResolvedValue(mockTemplate);
      const duplicated = { ...mockTemplate, id: 'tpl-2', nome: 'Vendas SAP (cópia)' };
      mockPrisma.mappingTemplate.create.mockResolvedValue(duplicated);
      const result = await repository.duplicate('tpl-1');
      expect(result?.nome).toContain('cópia');
    });

    it('should return null when original not found', async () => {
      mockPrisma.mappingTemplate.findFirst.mockResolvedValue(null);
      const result = await repository.duplicate('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('incrementUsage', () => {
    it('should increment usage count and set lastUsedAt', async () => {
      const updated = { ...mockTemplate, usageCount: 6, lastUsedAt: new Date() };
      mockPrisma.mappingTemplate.update.mockResolvedValue(updated);
      const result = await repository.incrementUsage('tpl-1');
      expect(result.usageCount).toBe(6);
    });
  });

  describe('findByHeaders', () => {
    it('should match templates by column headers', async () => {
      mockPrisma.mappingTemplate.findMany.mockResolvedValue([mockTemplate]);
      const results = await repository.findByHeaders(['sku', 'date', 'qty']);
      expect(results).toHaveLength(1);
      expect(results[0].matchScore).toBe(1.0);
      expect(results[0].matchCount).toBe(3);
    });

    it('should return partial matches sorted by score', async () => {
      mockPrisma.mappingTemplate.findMany.mockResolvedValue([mockTemplate]);
      const results = await repository.findByHeaders(['sku', 'other_column']);
      expect(results).toHaveLength(1);
      expect(results[0].matchScore).toBeCloseTo(1 / 3);
      expect(results[0].matchCount).toBe(1);
    });

    it('should return empty when no matches', async () => {
      mockPrisma.mappingTemplate.findMany.mockResolvedValue([mockTemplate]);
      const results = await repository.findByHeaders(['unknown_a', 'unknown_b']);
      expect(results).toHaveLength(0);
    });
  });
});
