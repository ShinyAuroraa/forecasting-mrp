import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ExportService } from '../export.service';
import { ExcelGeneratorService } from '../generators/excel.generator';
import { PdfGeneratorService } from '../generators/pdf.generator';
import { EXPORT_QUEUE_NAME, ASYNC_THRESHOLD } from '../export.types';

describe('ExportService', () => {
  let service: ExportService;
  let excelGenerator: Record<string, jest.Mock>;
  let pdfGenerator: Record<string, jest.Mock>;
  let queue: Record<string, jest.Mock>;

  beforeEach(async () => {
    excelGenerator = {
      generate: jest.fn().mockResolvedValue(Buffer.from('xlsx-data')),
      countRows: jest.fn().mockResolvedValue(100),
    };

    pdfGenerator = {
      generate: jest.fn().mockResolvedValue(Buffer.from('pdf-data')),
    };

    queue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
      getJob: jest.fn().mockResolvedValue(null),
      getCompleted: jest.fn().mockResolvedValue([]),
      getFailed: jest.fn().mockResolvedValue([]),
    };

    const module = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: ExcelGeneratorService, useValue: excelGenerator },
        { provide: PdfGeneratorService, useValue: pdfGenerator },
        { provide: getQueueToken(EXPORT_QUEUE_NAME), useValue: queue },
      ],
    }).compile();

    service = module.get(ExportService);
  });

  // ── generateSync ──────────────────────────────────────

  describe('generateSync', () => {
    it('should delegate to ExcelGenerator for xlsx format', async () => {
      const result = await service.generateSync('MRP_ORDERS', 'xlsx', {});
      expect(excelGenerator.generate).toHaveBeenCalledWith('MRP_ORDERS', {});
      expect(result.toString()).toBe('xlsx-data');
    });

    it('should delegate to PdfGenerator for pdf format', async () => {
      const result = await service.generateSync('EXECUTIVE_DASHBOARD', 'pdf', {});
      expect(pdfGenerator.generate).toHaveBeenCalledWith('EXECUTIVE_DASHBOARD', {});
      expect(result.toString()).toBe('pdf-data');
    });
  });

  // ── requestExport ─────────────────────────────────────

  describe('requestExport', () => {
    it('should return sync result for small exports', async () => {
      excelGenerator.countRows.mockResolvedValue(500);

      const result = await service.requestExport('MRP_ORDERS', 'xlsx', {}, 'user-1');

      expect(result.sync).toBe(true);
      if (result.sync) {
        expect(result.buffer).toBeDefined();
      }
    });

    it('should queue async job for large exports (>1000 rows)', async () => {
      excelGenerator.countRows.mockResolvedValue(ASYNC_THRESHOLD + 1);

      const result = await service.requestExport('MRP_ORDERS', 'xlsx', {}, 'user-1');

      expect(result.sync).toBe(false);
      if (!result.sync) {
        expect(result.jobId).toBe('job-123');
      }
      expect(queue.add).toHaveBeenCalledWith('generate-export', {
        type: 'MRP_ORDERS',
        format: 'xlsx',
        filters: {},
        userId: 'user-1',
      }, expect.any(Object));
    });

    it('should always be sync for PDF exports', async () => {
      const result = await service.requestExport('EXECUTIVE_DASHBOARD', 'pdf', {}, 'user-1');

      expect(result.sync).toBe(true);
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  // ── getDownloadFile ───────────────────────────────────

  describe('getDownloadFile', () => {
    it('should throw NotFoundException for unknown job', async () => {
      queue.getJob.mockResolvedValue(null);

      await expect(service.getDownloadFile('unknown')).rejects.toThrow('not found');
    });

    it('should throw NotFoundException when file not ready', async () => {
      queue.getJob.mockResolvedValue({ returnvalue: null });

      await expect(service.getDownloadFile('job-1')).rejects.toThrow('not ready');
    });
  });

  // ── getHistory ────────────────────────────────────────

  describe('getHistory', () => {
    it('should return empty array when no jobs', async () => {
      const result = await service.getHistory();
      expect(result).toEqual([]);
    });

    it('should return completed and failed jobs sorted by date', async () => {
      queue.getCompleted.mockResolvedValue([
        {
          id: 'j1',
          data: { type: 'MRP_ORDERS', format: 'xlsx', filters: {}, userId: 'u1' },
          returnvalue: { fileName: 'orders.xlsx' },
          timestamp: Date.now(),
          finishedOn: Date.now(),
        },
      ]);
      queue.getFailed.mockResolvedValue([
        {
          id: 'j2',
          data: { type: 'CAPACITY', format: 'xlsx', filters: {}, userId: 'u1' },
          timestamp: Date.now() - 1000,
          failedReason: 'timeout',
        },
      ]);

      const result = await service.getHistory();

      expect(result.length).toBe(2);
      expect(result[0].status).toBe('COMPLETED');
      expect(result[1].status).toBe('FAILED');
    });
  });

  // ── cleanupExpiredFiles ───────────────────────────────

  describe('cleanupExpiredFiles', () => {
    it('should return 0 when directory does not exist', async () => {
      const result = await service.cleanupExpiredFiles();
      expect(result).toBe(0);
    });
  });
});
