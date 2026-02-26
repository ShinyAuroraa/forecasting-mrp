import { Test, TestingModule } from '@nestjs/testing';
import { DailySummaryService } from '../daily-summary.service';
import { EmailSenderService } from '../email-sender.service';
import { EmailAggregatorService } from '../email-aggregator.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { DailySummaryData } from '../daily-summary.types';

// ────────────────────────────────────────────────────────────────
// Mocks
// ────────────────────────────────────────────────────────────────

const mockPrisma = {
  configSistema: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

const mockEmailSender = {
  getSmtpConfig: jest.fn(),
  saveSmtpConfig: jest.fn(),
  sendEmail: jest.fn(),
};

const mockAggregator = {
  aggregateDailySummary: jest.fn(),
};

const MOCK_DATA: DailySummaryData = {
  date: 'quarta-feira, 26/02/2026',
  stockAlerts: { belowSafetyStock: 2, approachingRop: 1, criticalSkus: [] },
  urgentPurchases: { totalValue: 5000, orderCount: 3, topSuppliers: [] },
  capacity: { overloadedCenters: [], totalOverloadAlerts: 0 },
  forecastAccuracy: { byClass: { A: 5.2 }, weeklyTrend: [] },
  pipelineSummary: null,
};

describe('DailySummaryService', () => {
  let service: DailySummaryService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailySummaryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailSenderService, useValue: mockEmailSender },
        { provide: EmailAggregatorService, useValue: mockAggregator },
      ],
    }).compile();

    service = module.get<DailySummaryService>(DailySummaryService);
  });

  // ────────────────────────────────────────────────────────────────
  // Recipients Config
  // ────────────────────────────────────────────────────────────────

  describe('getRecipientsConfig', () => {
    it('should return defaults when no config exists', async () => {
      mockPrisma.configSistema.findUnique.mockResolvedValue(null);

      const config = await service.getRecipientsConfig();

      expect(config.summary).toEqual([]);
      expect(config.briefing).toEqual([]);
      expect(config.cc).toEqual([]);
      expect(config.bcc).toEqual([]);
    });

    it('should return stored config', async () => {
      mockPrisma.configSistema.findUnique.mockResolvedValue({
        chave: 'automacao.email.destinatarios',
        valor: {
          summary: ['user@test.com'],
          briefing: ['mgr@test.com'],
          cc: [],
          bcc: [],
        },
      });

      const config = await service.getRecipientsConfig();

      expect(config.summary).toEqual(['user@test.com']);
      expect(config.briefing).toEqual(['mgr@test.com']);
    });
  });

  describe('saveRecipientsConfig', () => {
    it('should upsert recipients config', async () => {
      mockPrisma.configSistema.upsert.mockResolvedValue({});

      const input = { summary: ['a@b.com'], briefing: [], cc: [], bcc: [] };
      const result = await service.saveRecipientsConfig(input);

      expect(result).toEqual(input);
      expect(mockPrisma.configSistema.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { chave: 'automacao.email.destinatarios' },
        }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Full Config
  // ────────────────────────────────────────────────────────────────

  describe('getFullConfig', () => {
    it('should return SMTP config with masked password', async () => {
      mockEmailSender.getSmtpConfig.mockResolvedValue({
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        user: 'user',
        pass: 'secret123',
        fromAddress: 'from@test.com',
        fromName: 'Test',
      });
      mockPrisma.configSistema.findUnique.mockResolvedValue(null);

      const result = await service.getFullConfig();

      expect(result.smtp.pass).toBe('********');
      expect(result.smtp.host).toBe('smtp.test.com');
    });

    it('should return empty string for pass when not configured', async () => {
      mockEmailSender.getSmtpConfig.mockResolvedValue({
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        fromAddress: 'from@test.com',
        fromName: 'Test',
      });
      mockPrisma.configSistema.findUnique.mockResolvedValue(null);

      const result = await service.getFullConfig();

      expect(result.smtp.pass).toBe('');
    });
  });

  describe('saveFullConfig', () => {
    it('should save both SMTP and recipients', async () => {
      mockEmailSender.saveSmtpConfig.mockResolvedValue({});
      mockPrisma.configSistema.upsert.mockResolvedValue({});

      await service.saveFullConfig({
        smtp: { host: 'h', port: 587, secure: false, user: 'u', pass: 'p', fromAddress: 'f', fromName: 'n' },
        recipients: { summary: ['a@b.com'], briefing: [], cc: [], bcc: [] },
      });

      expect(mockEmailSender.saveSmtpConfig).toHaveBeenCalled();
      expect(mockPrisma.configSistema.upsert).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Send Summary / Briefing
  // ────────────────────────────────────────────────────────────────

  describe('sendSummary', () => {
    it('should aggregate data, build template, and send email', async () => {
      mockPrisma.configSistema.findUnique.mockResolvedValue({
        chave: 'automacao.email.destinatarios',
        valor: { summary: ['user@test.com'], briefing: [], cc: [], bcc: [] },
      });
      mockAggregator.aggregateDailySummary.mockResolvedValue(MOCK_DATA);
      mockEmailSender.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'msg-1',
        recipients: ['user@test.com'],
        error: null,
      });
      mockPrisma.configSistema.create.mockResolvedValue({});

      const result = await service.sendSummary();

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-1');
      expect(mockEmailSender.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['user@test.com'],
          subject: expect.stringContaining('Resumo Diario'),
        }),
      );
    });

    it('should return success with no recipients', async () => {
      mockPrisma.configSistema.findUnique.mockResolvedValue(null);
      mockPrisma.configSistema.create.mockResolvedValue({});

      const result = await service.sendSummary();

      expect(result.success).toBe(true);
      expect(result.recipients).toEqual([]);
      expect(mockEmailSender.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('sendBriefing', () => {
    it('should send briefing to briefing recipients', async () => {
      mockPrisma.configSistema.findUnique.mockResolvedValue({
        chave: 'automacao.email.destinatarios',
        valor: { summary: [], briefing: ['mgr@test.com'], cc: [], bcc: [] },
      });
      mockAggregator.aggregateDailySummary.mockResolvedValue(MOCK_DATA);
      mockEmailSender.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'msg-2',
        recipients: ['mgr@test.com'],
        error: null,
      });
      mockPrisma.configSistema.create.mockResolvedValue({});

      const result = await service.sendBriefing();

      expect(result.success).toBe(true);
      expect(mockEmailSender.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['mgr@test.com'],
          subject: expect.stringContaining('Briefing Matinal'),
        }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // History
  // ────────────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('should return paginated email logs', async () => {
      mockPrisma.configSistema.findMany.mockResolvedValue([
        {
          chave: 'email_log_123_RESUMO_DIARIO',
          valor: {
            tipo: 'RESUMO_DIARIO',
            recipients: ['user@test.com'],
            subject: 'Resumo Diario',
            success: true,
            messageId: 'msg-1',
            error: null,
            sentAt: '2026-02-26T10:00:00.000Z',
            createdAt: '2026-02-26T10:00:00.000Z',
          },
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getHistory({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].tipo).toBe('RESUMO_DIARIO');
      expect(result.data[0].statusEnvio).toBe('ENVIADO');
      expect(result.meta.total).toBe(1);
    });

    it('should filter by tipo', async () => {
      mockPrisma.configSistema.findMany.mockResolvedValue([
        {
          chave: 'email_log_1',
          valor: { tipo: 'RESUMO_DIARIO', success: true, recipients: [], createdAt: '2026-02-26T10:00:00.000Z' },
          updatedAt: new Date(),
        },
        {
          chave: 'email_log_2',
          valor: { tipo: 'BRIEFING_MATINAL', success: true, recipients: [], createdAt: '2026-02-26T11:00:00.000Z' },
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getHistory({ tipo: 'BRIEFING_MATINAL', page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].tipo).toBe('BRIEFING_MATINAL');
    });

    it('should filter by status', async () => {
      mockPrisma.configSistema.findMany.mockResolvedValue([
        {
          chave: 'email_log_1',
          valor: { tipo: 'RESUMO_DIARIO', success: true, messageId: 'msg', recipients: [], error: null, createdAt: '2026-02-26T10:00:00.000Z' },
          updatedAt: new Date(),
        },
        {
          chave: 'email_log_2',
          valor: { tipo: 'RESUMO_DIARIO', success: false, messageId: null, recipients: [], error: 'SMTP error', createdAt: '2026-02-26T11:00:00.000Z' },
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getHistory({ status: 'FALHA', page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].statusEnvio).toBe('FALHA');
    });
  });
});
