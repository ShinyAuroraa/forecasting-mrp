import { BadRequestException } from '@nestjs/common';
import { ImportProdutosService } from './import-produtos.service';

const mockPrisma = {
  produto: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

describe('ImportProdutosService', () => {
  let service: ImportProdutosService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ImportProdutosService(mockPrisma as any);
    mockPrisma.produto.findMany.mockResolvedValue([]);
  });

  const createCsvFile = (content: string): Express.Multer.File =>
    ({
      buffer: Buffer.from(content),
      mimetype: 'text/csv',
      originalname: 'products.csv',
    }) as Express.Multer.File;

  describe('CSV parsing', () => {
    it('should import valid CSV rows', async () => {
      mockPrisma.produto.create.mockResolvedValue({});

      const csv =
        'codigo,descricao,tipo_produto\nSKU-001,Produto A,ACABADO\nSKU-002,Produto B,INSUMO';
      const result = await service.processImport(createCsvFile(csv));

      expect(result.imported).toBe(2);
      expect(result.rejected).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle semicolon delimiter', async () => {
      mockPrisma.produto.create.mockResolvedValue({});

      const csv =
        'codigo;descricao;tipo_produto\nSKU-001;Produto A;ACABADO';
      const result = await service.processImport(createCsvFile(csv));

      expect(result.imported).toBe(1);
    });

    it('should report errors for missing required fields', async () => {
      const csv = 'codigo,descricao,tipo_produto\n,Produto A,ACABADO';
      const result = await service.processImport(createCsvFile(csv));

      expect(result.rejected).toBe(1);
      expect(result.errors[0].field).toBe('codigo');
      expect(result.errors[0].message).toBe('Required field');
    });

    it('should report errors for invalid enum values', async () => {
      const csv =
        'codigo,descricao,tipo_produto\nSKU-001,Produto A,INVALIDO';
      const result = await service.processImport(createCsvFile(csv));

      expect(result.rejected).toBe(1);
      expect(result.errors[0].field).toBe('tipo_produto');
      expect(result.errors[0].message).toContain('Invalid value');
    });

    it('should detect duplicate codigo within file', async () => {
      mockPrisma.produto.create.mockResolvedValue({});

      const csv =
        'codigo,descricao,tipo_produto\nSKU-001,Produto A,ACABADO\nSKU-001,Produto B,INSUMO';
      const result = await service.processImport(createCsvFile(csv));

      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Duplicate codigo within file');
    });

    it('should detect duplicate codigo against database', async () => {
      mockPrisma.produto.findMany.mockResolvedValue([
        { codigo: 'SKU-001' },
      ]);

      const csv =
        'codigo,descricao,tipo_produto\nSKU-001,Produto A,ACABADO';
      const result = await service.processImport(createCsvFile(csv));

      expect(result.rejected).toBe(1);
      expect(result.errors[0].message).toContain('already exists in database');
    });

    it('should handle partial success', async () => {
      mockPrisma.produto.create.mockResolvedValue({});

      const csv =
        'codigo,descricao,tipo_produto\nSKU-001,Produto A,ACABADO\n,,\nSKU-002,Produto B,INSUMO';
      const result = await service.processImport(createCsvFile(csv));

      expect(result.imported).toBe(2);
      expect(result.rejected).toBe(1);
    });
  });

  describe('file validation', () => {
    it('should reject unsupported file types', async () => {
      const file = {
        buffer: Buffer.from('data'),
        mimetype: 'application/pdf',
        originalname: 'file.pdf',
      } as Express.Multer.File;

      await expect(service.processImport(file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when file has no data rows', async () => {
      const csv = 'codigo,descricao,tipo_produto\n';
      await expect(
        service.processImport(createCsvFile(csv)),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('invalid politica_ressuprimento', () => {
    it('should report error for invalid politica value', async () => {
      const csv =
        'codigo,descricao,tipo_produto,politica_ressuprimento\nSKU-001,Produto A,ACABADO,INVALIDO';
      const result = await service.processImport(createCsvFile(csv));

      expect(result.errors.some((e) => e.field === 'politica_ressuprimento')).toBe(true);
    });
  });
});
