import { Test, TestingModule } from '@nestjs/testing';
import { DailySummaryController } from '../daily-summary.controller';
import { DailySummaryService } from '../daily-summary.service';

const mockService = {
  sendSummary: jest.fn(),
  sendBriefing: jest.fn(),
  getFullConfig: jest.fn(),
  saveFullConfig: jest.fn(),
  getHistory: jest.fn(),
};

describe('DailySummaryController', () => {
  let controller: DailySummaryController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DailySummaryController],
      providers: [{ provide: DailySummaryService, useValue: mockService }],
    }).compile();

    controller = module.get<DailySummaryController>(DailySummaryController);
  });

  describe('POST /send-summary', () => {
    it('should call sendSummary and return result', async () => {
      const result = { success: true, messageId: 'msg-1', recipients: ['a@b.com'], error: null };
      mockService.sendSummary.mockResolvedValue(result);

      const response = await controller.sendSummary();

      expect(response).toEqual(result);
      expect(mockService.sendSummary).toHaveBeenCalled();
    });
  });

  describe('POST /send-briefing', () => {
    it('should call sendBriefing and return result', async () => {
      const result = { success: true, messageId: 'msg-2', recipients: ['mgr@b.com'], error: null };
      mockService.sendBriefing.mockResolvedValue(result);

      const response = await controller.sendBriefing();

      expect(response).toEqual(result);
      expect(mockService.sendBriefing).toHaveBeenCalled();
    });
  });

  describe('GET /config', () => {
    it('should return full email config', async () => {
      const config = {
        smtp: { host: 'smtp.test.com', port: 587, secure: false, user: 'u', pass: '********', fromAddress: 'f', fromName: 'n' },
        recipients: { summary: ['a@b.com'], briefing: [], cc: [], bcc: [] },
      };
      mockService.getFullConfig.mockResolvedValue(config);

      const response = await controller.getConfig();

      expect(response).toEqual(config);
    });
  });

  describe('PUT /config', () => {
    it('should save config and return success', async () => {
      mockService.saveFullConfig.mockResolvedValue(undefined);

      const dto = {
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        user: 'u',
        pass: 'p',
        fromAddress: 'from@test.com',
        fromName: 'Test',
        summaryRecipients: ['a@b.com'],
        briefingRecipients: ['c@d.com'],
        cc: [],
        bcc: [],
      };

      const response = await controller.updateConfig(dto as any);

      expect(response).toEqual({ success: true });
      expect(mockService.saveFullConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          smtp: expect.objectContaining({ host: 'smtp.test.com' }),
          recipients: expect.objectContaining({ summary: ['a@b.com'] }),
        }),
      );
    });
  });

  describe('GET /history', () => {
    it('should return paginated history', async () => {
      const history = {
        data: [{ id: '1', tipo: 'RESUMO_DIARIO', statusEnvio: 'ENVIADO' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockService.getHistory.mockResolvedValue(history);

      const response = await controller.getHistory({ page: 1, limit: 20 } as any);

      expect(response).toEqual(history);
      expect(mockService.getHistory).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });
  });
});
