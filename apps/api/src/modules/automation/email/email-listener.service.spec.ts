import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EmailListenerService } from './email-listener.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { IngestaoUploadService } from '../../ingestao/ingestao-upload.service';
import { PdfOcrService } from '../ocr/pdf-ocr.service';

describe('EmailListenerService', () => {
  let service: EmailListenerService;
  let prisma: jest.Mocked<PrismaService>;
  let uploadService: jest.Mocked<IngestaoUploadService>;
  let pdfOcrService: jest.Mocked<PdfOcrService>;

  const mockConfig = {
    adapterType: 'IMAP' as const,
    imap: { host: 'imap.test.com', port: 993, username: 'user', password: 'pass', tls: true },
    filters: { sender: 'erp@test.com', hasAttachment: true },
    cronExpression: '0 6 * * *',
    maxAttachmentSizeMb: 25,
    allowedExtensions: ['.csv', '.xlsx', '.pdf'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailListenerService,
        {
          provide: PrismaService,
          useValue: {
            configSistema: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
            },
          },
        },
        {
          provide: IngestaoUploadService,
          useValue: { processUpload: jest.fn() },
        },
        {
          provide: PdfOcrService,
          useValue: {
            extractFromPdf: jest.fn(),
            toCsv: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(EmailListenerService);
    prisma = module.get(PrismaService);
    uploadService = module.get(IngestaoUploadService);
    pdfOcrService = module.get(PdfOcrService);
  });

  describe('getConfig', () => {
    it('should return config when found', async () => {
      (prisma.configSistema.findUnique as jest.Mock).mockResolvedValue({
        chave: 'automacao.email',
        valor: mockConfig,
      });

      const result = await service.getConfig();
      expect(result).toEqual(mockConfig);
    });

    it('should return null when no config', async () => {
      (prisma.configSistema.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getConfig();
      expect(result).toBeNull();
    });
  });

  describe('saveConfig', () => {
    it('should upsert config to config_sistema', async () => {
      (prisma.configSistema.upsert as jest.Mock).mockResolvedValue({});

      const result = await service.saveConfig(mockConfig);
      expect(result).toEqual(mockConfig);
      expect(prisma.configSistema.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { chave: 'automacao.email' },
        }),
      );
    });
  });

  describe('testConnection', () => {
    it('should throw NotFoundException when no config', async () => {
      (prisma.configSistema.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.testConnection()).rejects.toThrow(NotFoundException);
    });
  });

  describe('processEmails', () => {
    it('should throw NotFoundException when no config', async () => {
      (prisma.configSistema.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.processEmails()).rejects.toThrow(NotFoundException);
    });

    it('should process emails and return result on happy path', async () => {
      const config = {
        ...mockConfig,
        maxAttachmentSizeMb: 25,
        allowedExtensions: ['.csv', '.xlsx', '.pdf'],
      };

      // getConfig call
      (prisma.configSistema.findUnique as jest.Mock)
        .mockResolvedValueOnce({ chave: 'automacao.email', valor: config })
        // getExecutionLogs/saveLog findUnique call
        .mockResolvedValueOnce(null);

      // upsert for saveExecutionLog
      (prisma.configSistema.upsert as jest.Mock).mockResolvedValue({});

      // Mock EmailAdapterFactory by mocking the module
      const mockAdapter = {
        fetchEmails: jest.fn().mockResolvedValue([
          {
            id: 'email-1',
            from: 'erp@test.com',
            subject: 'Fechamento',
            date: new Date(),
            attachments: [
              { id: 'att-1', filename: 'data.csv', mimeType: 'text/csv', size: 1024 },
            ],
          },
        ]),
        downloadAttachment: jest.fn().mockResolvedValue(Buffer.from('col1,col2\nA,B')),
        testConnection: jest.fn(),
      };

      // Spy on EmailAdapterFactory.create to return our mock
      jest.spyOn(
        require('./email-adapter.factory').EmailAdapterFactory,
        'create',
      ).mockReturnValue(mockAdapter);

      (uploadService.processUpload as jest.Mock).mockResolvedValue({
        imported: 10,
        updated: 2,
        rejected: 0,
      });

      const result = await service.processEmails();

      expect(result.emailsFound).toBe(1);
      expect(result.attachmentsProcessed).toBe(1);
      expect(result.rowsIngested).toBe(12);
      expect(result.errors).toHaveLength(0);
      expect(result.timestamp).toBeDefined();
      expect(mockAdapter.downloadAttachment).toHaveBeenCalledWith('email-1', 'att-1');
    });
  });

  describe('getExecutionLogs', () => {
    it('should return empty array when no logs exist', async () => {
      (prisma.configSistema.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getExecutionLogs();
      expect(result).toEqual([]);
    });

    it('should return sliced logs with limit', async () => {
      const logs = Array.from({ length: 30 }, (_, i) => ({ emailsFound: i }));
      (prisma.configSistema.findUnique as jest.Mock).mockResolvedValue({
        chave: 'automacao.email.logs',
        valor: logs,
      });

      const result = await service.getExecutionLogs(10);
      expect(result).toHaveLength(10);
    });

    it('should return last 20 entries by default', async () => {
      const logs = Array.from({ length: 30 }, (_, i) => ({ emailsFound: i }));
      (prisma.configSistema.findUnique as jest.Mock).mockResolvedValue({
        chave: 'automacao.email.logs',
        valor: logs,
      });

      const result = await service.getExecutionLogs();
      expect(result).toHaveLength(20);
    });
  });
});
