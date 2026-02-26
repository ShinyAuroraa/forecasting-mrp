import { BadRequestException } from '@nestjs/common';
import { IngestaoUploadService } from './ingestao-upload.service';

const mockPrisma = {
  produto: {
    findMany: jest.fn(),
  },
  serieTemporal: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('IngestaoUploadService', () => {
  let service: IngestaoUploadService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IngestaoUploadService(mockPrisma as any);
  });

  describe('processUpload', () => {
    const createCsvFile = (content: string) =>
      ({
        buffer: Buffer.from(content, 'utf-8'),
        mimetype: 'text/csv',
        originalname: 'test.csv',
      }) as Express.Multer.File;

    beforeEach(() => {
      mockPrisma.produto.findMany.mockResolvedValue([
        { id: 'p1', codigo: 'SKU-001' },
        { id: 'p2', codigo: 'SKU-002' },
      ]);
    });

    it('should import valid CSV rows', async () => {
      mockPrisma.serieTemporal.findFirst.mockResolvedValue(null);
      mockPrisma.serieTemporal.create.mockResolvedValue({ id: '1' });

      const csv = 'codigo,data,volume,receita\nSKU-001,2026-01-15,100,5000\nSKU-002,2026-01-15,200,8000';
      const result = await service.processUpload(createCsvFile(csv));

      expect(result.imported).toBe(2);
      expect(result.rejected).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should update existing records (upsert)', async () => {
      mockPrisma.serieTemporal.findFirst.mockResolvedValue({ id: 'existing-1' });
      mockPrisma.serieTemporal.update.mockResolvedValue({ id: 'existing-1' });

      const csv = 'codigo,data,volume\nSKU-001,2026-01-15,150';
      const result = await service.processUpload(createCsvFile(csv));

      expect(result.imported).toBe(0);
      expect(result.updated).toBe(1);
    });

    it('should reject rows with unknown SKU', async () => {
      const csv = 'codigo,data,volume\nUNKNOWN,2026-01-15,100';
      const result = await service.processUpload(createCsvFile(csv));

      expect(result.rejected).toBe(1);
      expect(result.errors[0].field).toBe('codigo');
      expect(result.errors[0].message).toContain('SKU not found');
    });

    it('should reject rows without codigo', async () => {
      const csv = 'codigo,data,volume\n,2026-01-15,100';
      const result = await service.processUpload(createCsvFile(csv));

      expect(result.rejected).toBe(1);
      expect(result.errors[0].field).toBe('codigo');
    });

    it('should reject rows without date', async () => {
      const csv = 'codigo,data,volume\nSKU-001,,100';
      const result = await service.processUpload(createCsvFile(csv));

      expect(result.rejected).toBe(1);
      expect(result.errors[0].field).toBe('dataReferencia');
    });

    it('should reject rows without volume and receita', async () => {
      const csv = 'codigo,data\nSKU-001,2026-01-15';
      const result = await service.processUpload(createCsvFile(csv));

      expect(result.rejected).toBe(1);
      expect(result.errors[0].field).toBe('volume/receita');
    });

    it('should handle semicolon-delimited CSV', async () => {
      mockPrisma.serieTemporal.findFirst.mockResolvedValue(null);
      mockPrisma.serieTemporal.create.mockResolvedValue({ id: '1' });

      const csv = 'codigo;data;volume;receita\nSKU-001;2026-01-15;100;5000';
      const result = await service.processUpload(createCsvFile(csv));

      expect(result.imported).toBe(1);
    });

    it('should parse DD/MM/YYYY date format', async () => {
      mockPrisma.serieTemporal.findFirst.mockResolvedValue(null);
      mockPrisma.serieTemporal.create.mockResolvedValue({ id: '1' });

      const csv = 'codigo,data,volume\nSKU-001,15/01/2026,100';
      const result = await service.processUpload(createCsvFile(csv));

      expect(result.imported).toBe(1);
    });

    it('should throw on empty file', async () => {
      const csv = 'codigo,data,volume';
      await expect(service.processUpload(createCsvFile(csv))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw on unsupported file format', async () => {
      const file = {
        buffer: Buffer.from('data'),
        mimetype: 'application/pdf',
        originalname: 'test.pdf',
      } as Express.Multer.File;
      await expect(service.processUpload(file)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
