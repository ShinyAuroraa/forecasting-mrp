import { NotFoundException } from '@nestjs/common';
import { MappingTemplateService } from './mapping-template.service';

const mockTemplate = {
  id: 'tpl-1',
  nome: 'Vendas SAP',
  descricao: 'Template para vendas do SAP',
  tipoFonte: 'CSV',
  colunas: [
    { sourceColumn: 'sku', targetField: 'codigo', dataType: 'string', required: true },
    { sourceColumn: 'date', targetField: 'dataReferencia', dataType: 'date', required: true },
    { sourceColumn: 'qty', targetField: 'volume', dataType: 'number', required: false },
  ],
  validationRules: null,
  lastUsedAt: null,
  usageCount: 0,
  ativo: true,
  createdAt: '2026-02-27T00:00:00Z',
  updatedAt: '2026-02-27T00:00:00Z',
};

const mockRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  duplicate: jest.fn(),
  incrementUsage: jest.fn(),
  findByHeaders: jest.fn(),
};

describe('MappingTemplateService', () => {
  let service: MappingTemplateService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MappingTemplateService(mockRepository as any);
  });

  describe('create', () => {
    it('should delegate to repository', async () => {
      mockRepository.create.mockResolvedValue(mockTemplate);
      const dto = {
        nome: 'Vendas SAP',
        tipoFonte: 'CSV',
        colunas: mockTemplate.colunas,
      };
      const result = await service.create(dto as any);
      expect(result).toEqual(mockTemplate);
      expect(mockRepository.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const paginated = {
        data: [mockTemplate],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockRepository.findAll.mockResolvedValue(paginated);
      const result = await service.findAll({} as any);
      expect(result).toEqual(paginated);
    });
  });

  describe('findById', () => {
    it('should return when found', async () => {
      mockRepository.findById.mockResolvedValue(mockTemplate);
      const result = await service.findById('tpl-1');
      expect(result).toEqual(mockTemplate);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update when template exists', async () => {
      mockRepository.findById.mockResolvedValue(mockTemplate);
      const updated = { ...mockTemplate, nome: 'Updated' };
      mockRepository.update.mockResolvedValue(updated);
      const result = await service.update('tpl-1', { nome: 'Updated' });
      expect(result.nome).toBe('Updated');
    });

    it('should throw NotFoundException when template not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(
        service.update('non-existent', { nome: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should soft-delete when template exists', async () => {
      mockRepository.findById.mockResolvedValue(mockTemplate);
      mockRepository.delete.mockResolvedValue({ ...mockTemplate, ativo: false });
      const result = await service.delete('tpl-1');
      expect(result.ativo).toBe(false);
    });

    it('should throw NotFoundException when template not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(service.delete('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('duplicate', () => {
    it('should return duplicated template', async () => {
      const duplicated = { ...mockTemplate, id: 'tpl-2', nome: 'Vendas SAP (cópia)' };
      mockRepository.duplicate.mockResolvedValue(duplicated);
      const result = await service.duplicate('tpl-1');
      expect(result.nome).toContain('cópia');
    });

    it('should throw NotFoundException when original not found', async () => {
      mockRepository.duplicate.mockResolvedValue(null);
      await expect(service.duplicate('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('suggestTemplates', () => {
    it('should return suggestions sorted by match score', async () => {
      const suggestions = [
        { template: mockTemplate, matchScore: 1.0, matchCount: 3 },
      ];
      mockRepository.findByHeaders.mockResolvedValue(suggestions);
      const result = await service.suggestTemplates(['sku', 'date', 'qty']);
      expect(result).toHaveLength(1);
      expect(result[0].matchScore).toBe(1.0);
    });

    it('should return empty when no templates match', async () => {
      mockRepository.findByHeaders.mockResolvedValue([]);
      const result = await service.suggestTemplates(['unknown_column']);
      expect(result).toHaveLength(0);
    });
  });

  describe('incrementUsage', () => {
    it('should delegate to repository', async () => {
      const updated = { ...mockTemplate, usageCount: 1, lastUsedAt: new Date().toISOString() };
      mockRepository.incrementUsage.mockResolvedValue(updated);
      const result = await service.incrementUsage('tpl-1');
      expect(result.usageCount).toBe(1);
    });
  });
});
