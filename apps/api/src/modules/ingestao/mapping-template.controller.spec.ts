import { MappingTemplateController } from './mapping-template.controller';

const mockService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  duplicate: jest.fn(),
  suggestTemplates: jest.fn(),
};

describe('MappingTemplateController', () => {
  let controller: MappingTemplateController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MappingTemplateController(mockService as any);
  });

  describe('findAll', () => {
    it('should call service.findAll with filters', async () => {
      const filters = { search: 'SAP', tipoFonte: 'CSV' };
      mockService.findAll.mockResolvedValue({ data: [], meta: {} });
      await controller.findAll(filters as any);
      expect(mockService.findAll).toHaveBeenCalledWith(filters);
    });
  });

  describe('findOne', () => {
    it('should call service.findById', async () => {
      mockService.findById.mockResolvedValue({ id: 'tpl-1' });
      const result = await controller.findOne('tpl-1');
      expect(result.id).toBe('tpl-1');
    });
  });

  describe('create', () => {
    it('should call service.create', async () => {
      const dto = { nome: 'Test', tipoFonte: 'CSV', colunas: [] };
      mockService.create.mockResolvedValue({ id: 'tpl-1', ...dto });
      const result = await controller.create(dto as any);
      expect(result.nome).toBe('Test');
    });
  });

  describe('update', () => {
    it('should call service.update', async () => {
      mockService.update.mockResolvedValue({ id: 'tpl-1', nome: 'Updated' });
      const result = await controller.update('tpl-1', { nome: 'Updated' } as any);
      expect(result.nome).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('should call service.delete and return void', async () => {
      mockService.delete.mockResolvedValue({ id: 'tpl-1', ativo: false });
      const result = await controller.remove('tpl-1');
      expect(result).toBeUndefined();
      expect(mockService.delete).toHaveBeenCalledWith('tpl-1');
    });
  });

  describe('duplicate', () => {
    it('should call service.duplicate', async () => {
      mockService.duplicate.mockResolvedValue({ id: 'tpl-2', nome: 'Copy' });
      const result = await controller.duplicate('tpl-1');
      expect(result.id).toBe('tpl-2');
    });
  });

  describe('suggest', () => {
    it('should call service.suggestTemplates with headers', async () => {
      mockService.suggestTemplates.mockResolvedValue([]);
      await controller.suggest({ headers: ['sku', 'date'] });
      expect(mockService.suggestTemplates).toHaveBeenCalledWith(['sku', 'date']);
    });
  });
});
