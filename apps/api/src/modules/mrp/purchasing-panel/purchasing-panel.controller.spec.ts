import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { PurchasingPanelController } from './purchasing-panel.controller';
import { PurchasingPanelService } from './purchasing-panel.service';
import type { PurchasingPanelResponse, EmailSummaryResult } from './interfaces/purchasing-panel.interface';

describe('PurchasingPanelController', () => {
  let controller: PurchasingPanelController;
  let service: jest.Mocked<PurchasingPanelService>;

  const mockExecucaoId = '123e4567-e89b-12d3-a456-426614174000';

  const mockPanelData: PurchasingPanelResponse = {
    execucaoId: mockExecucaoId,
    generatedAt: '2026-02-26T00:00:00.000Z',
    urgentActions: [
      {
        orderId: 'order-1',
        produtoCodigo: 'SKU-001',
        produtoDescricao: 'Produto Teste',
        quantidade: 100,
        fornecedorNome: 'Fornecedor ABC',
        fornecedorId: 'forn-1',
        dataLiberacao: '2026-02-28',
        dataNecessidade: '2026-03-05',
        custoEstimado: 5000,
        prioridade: 'ALTA',
        mensagemAcao: null,
      },
    ],
    supplierSummary: [
      {
        fornecedorId: 'forn-1',
        fornecedorNome: 'Fornecedor ABC',
        totalOrders: 3,
        totalQuantidade: 500,
        totalCusto: 25000,
        orders: [],
      },
    ],
    totals: {
      totalPurchaseCost: 25000,
      totalOrders: 3,
      urgentOrders: 1,
      averageLeadTimeDays: 14,
    },
  };

  const mockEmailResult: EmailSummaryResult = {
    sent: true,
    recipients: ['compras@test.com'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchasingPanelController],
      providers: [
        {
          provide: PurchasingPanelService,
          useValue: {
            getPanelData: jest.fn(),
            getExportData: jest.fn(),
            sendEmailSummary: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PurchasingPanelController>(
      PurchasingPanelController,
    );
    service = module.get(PurchasingPanelService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ────────────────────────────────────────────────────────────────
  // GET /mrp/purchasing-panel
  // ────────────────────────────────────────────────────────────────

  describe('getPanelData', () => {
    it('should return structured panel data', async () => {
      service.getPanelData.mockResolvedValue(mockPanelData);

      const result = await controller.getPanelData({
        execucaoId: mockExecucaoId,
      });

      expect(result).toEqual(mockPanelData);
      expect(result.urgentActions).toHaveLength(1);
      expect(result.supplierSummary).toHaveLength(1);
      expect(result.totals.totalPurchaseCost).toBe(25000);
    });

    it('should propagate NotFoundException for invalid execution', async () => {
      service.getPanelData.mockRejectedValue(
        new NotFoundException('Execution not found'),
      );

      await expect(
        controller.getPanelData({ execucaoId: 'not-found' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // GET /mrp/purchasing-panel/export
  // ────────────────────────────────────────────────────────────────

  describe('exportExcel', () => {
    it('should return xlsx buffer with correct headers', async () => {
      const mockBuffer = Buffer.from('xlsx-content');
      service.getExportData.mockResolvedValue(mockBuffer);

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await controller.exportExcel(
        { execucaoId: mockExecucaoId },
        mockRes as never,
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename=purchasing-panel-'),
      );
      expect(mockRes.send).toHaveBeenCalledWith(mockBuffer);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // POST /mrp/purchasing-panel/email-summary
  // ────────────────────────────────────────────────────────────────

  describe('sendEmailSummary', () => {
    it('should return email send result', async () => {
      service.sendEmailSummary.mockResolvedValue(mockEmailResult);

      const result = await controller.sendEmailSummary({
        execucaoId: mockExecucaoId,
      });

      expect(result.sent).toBe(true);
      expect(result.recipients).toEqual(['compras@test.com']);
    });

    it('should call service with the provided execucaoId', async () => {
      service.sendEmailSummary.mockResolvedValue(mockEmailResult);

      await controller.sendEmailSummary({ execucaoId: mockExecucaoId });

      expect(service.sendEmailSummary).toHaveBeenCalledWith(mockExecucaoId);
    });

    it('should propagate NotFoundException for invalid execution', async () => {
      service.sendEmailSummary.mockRejectedValue(
        new NotFoundException('Execution not found'),
      );

      await expect(
        controller.sendEmailSummary({ execucaoId: 'not-found' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
