import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { PurchasingPanelService } from './purchasing-panel.service';
import { ExcelExportService } from './excel-export.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('PurchasingPanelService', () => {
  let service: PurchasingPanelService;
  let prisma: {
    execucaoPlanejamento: { findUnique: jest.Mock };
    ordemPlanejada: { findMany: jest.Mock };
    configSistema: { findUnique: jest.Mock };
  };
  let excelExportService: { generatePurchasingReport: jest.Mock };

  const mockExecucaoId = '123e4567-e89b-12d3-a456-426614174000';

  // Helper: create a mock order
  const createMockOrder = (overrides: Partial<{
    id: string;
    fornecedorId: string | null;
    dataLiberacao: Date;
    dataNecessidade: Date;
    quantidade: number;
    custoEstimado: number;
    prioridade: string;
    mensagemAcao: string | null;
    produto: { codigo: string; descricao: string };
    fornecedor: { id: string; razaoSocial: string; leadTimePadraoDias: number | null } | null;
  }> = {}) => ({
    id: 'order-1',
    execucaoId: mockExecucaoId,
    produtoId: 'prod-1',
    tipo: 'COMPRA',
    quantidade: 100,
    dataNecessidade: new Date('2026-03-05'),
    dataLiberacao: new Date('2026-02-28'),
    fornecedorId: 'forn-1',
    custoEstimado: 5000,
    prioridade: 'ALTA',
    status: 'PLANEJADA',
    mensagemAcao: null,
    produto: { codigo: 'SKU-001', descricao: 'Produto Teste' },
    fornecedor: {
      id: 'forn-1',
      razaoSocial: 'Fornecedor ABC',
      leadTimePadraoDias: 14,
    },
    ...overrides,
  });

  beforeEach(async () => {
    // Freeze "today" for consistent test results
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-26T00:00:00.000Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasingPanelService,
        {
          provide: ExcelExportService,
          useValue: {
            generatePurchasingReport: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            execucaoPlanejamento: {
              findUnique: jest.fn(),
            },
            ordemPlanejada: {
              findMany: jest.fn(),
            },
            configSistema: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PurchasingPanelService>(PurchasingPanelService);
    prisma = module.get(PrismaService);
    excelExportService = module.get(ExcelExportService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ────────────────────────────────────────────────────────────────
  // getPanelData
  // ────────────────────────────────────────────────────────────────

  describe('getPanelData', () => {
    it('should throw NotFoundException when execution does not exist', async () => {
      prisma.execucaoPlanejamento.findUnique.mockResolvedValue(null);

      await expect(service.getPanelData(mockExecucaoId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return structured panel data with all sections', async () => {
      prisma.execucaoPlanejamento.findUnique.mockResolvedValue({
        id: mockExecucaoId,
      });

      const urgentOrder = createMockOrder({
        id: 'order-urgent-1',
        dataLiberacao: new Date('2026-02-28'), // within 7 days of 2026-02-26
        prioridade: 'CRITICA',
      });

      prisma.ordemPlanejada.findMany.mockResolvedValue([urgentOrder]);

      const result = await service.getPanelData(mockExecucaoId);

      expect(result.execucaoId).toBe(mockExecucaoId);
      expect(result.generatedAt).toBeDefined();
      expect(result.urgentActions).toHaveLength(1);
      expect(result.supplierSummary).toHaveLength(1);
      expect(result.totals).toBeDefined();
    });

    it('should only include orders with dataLiberacao within next 7 days in urgent actions', async () => {
      prisma.execucaoPlanejamento.findUnique.mockResolvedValue({
        id: mockExecucaoId,
      });

      const urgentOrder = createMockOrder({
        id: 'order-urgent',
        dataLiberacao: new Date('2026-03-01'), // within 7 days
      });

      const nonUrgentOrder = createMockOrder({
        id: 'order-not-urgent',
        dataLiberacao: new Date('2026-04-15'), // far in the future
      });

      prisma.ordemPlanejada.findMany.mockResolvedValue([
        urgentOrder,
        nonUrgentOrder,
      ]);

      const result = await service.getPanelData(mockExecucaoId);

      expect(result.urgentActions).toHaveLength(1);
      expect(result.urgentActions[0].orderId).toBe('order-urgent');
    });

    it('should sort urgent actions by dataLiberacao ASC', async () => {
      prisma.execucaoPlanejamento.findUnique.mockResolvedValue({
        id: mockExecucaoId,
      });

      const order1 = createMockOrder({
        id: 'order-1',
        dataLiberacao: new Date('2026-03-02'),
      });

      const order2 = createMockOrder({
        id: 'order-2',
        dataLiberacao: new Date('2026-02-27'),
      });

      // Prisma returns them sorted by dataLiberacao ASC (from our orderBy)
      prisma.ordemPlanejada.findMany.mockResolvedValue([order2, order1]);

      const result = await service.getPanelData(mockExecucaoId);

      // Both should be urgent (within 7 days of 2026-02-26)
      expect(result.urgentActions).toHaveLength(2);
      expect(result.urgentActions[0].orderId).toBe('order-2');
      expect(result.urgentActions[1].orderId).toBe('order-1');
    });

    it('should correctly group orders by supplier in supplierSummary', async () => {
      prisma.execucaoPlanejamento.findUnique.mockResolvedValue({
        id: mockExecucaoId,
      });

      const order1 = createMockOrder({
        id: 'order-1',
        fornecedorId: 'forn-A',
        fornecedor: {
          id: 'forn-A',
          razaoSocial: 'Fornecedor A',
          leadTimePadraoDias: 10,
        },
        quantidade: 50,
        custoEstimado: 2500,
      });

      const order2 = createMockOrder({
        id: 'order-2',
        fornecedorId: 'forn-A',
        fornecedor: {
          id: 'forn-A',
          razaoSocial: 'Fornecedor A',
          leadTimePadraoDias: 10,
        },
        quantidade: 30,
        custoEstimado: 1500,
      });

      const order3 = createMockOrder({
        id: 'order-3',
        fornecedorId: 'forn-B',
        fornecedor: {
          id: 'forn-B',
          razaoSocial: 'Fornecedor B',
          leadTimePadraoDias: 7,
        },
        quantidade: 100,
        custoEstimado: 10000,
      });

      prisma.ordemPlanejada.findMany.mockResolvedValue([
        order1,
        order2,
        order3,
      ]);

      const result = await service.getPanelData(mockExecucaoId);

      expect(result.supplierSummary).toHaveLength(2);

      const supplierA = result.supplierSummary.find(
        (s) => s.fornecedorId === 'forn-A',
      );
      expect(supplierA).toBeDefined();
      expect(supplierA!.totalOrders).toBe(2);
      expect(supplierA!.totalQuantidade).toBe(80);
      expect(supplierA!.totalCusto).toBe(4000);

      const supplierB = result.supplierSummary.find(
        (s) => s.fornecedorId === 'forn-B',
      );
      expect(supplierB).toBeDefined();
      expect(supplierB!.totalOrders).toBe(1);
      expect(supplierB!.totalCusto).toBe(10000);
    });

    it('should calculate correct aggregate totals', async () => {
      prisma.execucaoPlanejamento.findUnique.mockResolvedValue({
        id: mockExecucaoId,
      });

      const order1 = createMockOrder({
        id: 'order-1',
        custoEstimado: 5000,
        dataLiberacao: new Date('2026-02-28'), // urgent
        fornecedor: {
          id: 'forn-1',
          razaoSocial: 'F1',
          leadTimePadraoDias: 10,
        },
      });

      const order2 = createMockOrder({
        id: 'order-2',
        custoEstimado: 3000,
        dataLiberacao: new Date('2026-04-15'), // not urgent
        fornecedorId: 'forn-2',
        fornecedor: {
          id: 'forn-2',
          razaoSocial: 'F2',
          leadTimePadraoDias: 20,
        },
      });

      prisma.ordemPlanejada.findMany.mockResolvedValue([order1, order2]);

      const result = await service.getPanelData(mockExecucaoId);

      expect(result.totals.totalPurchaseCost).toBe(8000);
      expect(result.totals.totalOrders).toBe(2);
      expect(result.totals.urgentOrders).toBe(1);
      expect(result.totals.averageLeadTimeDays).toBe(15); // (10 + 20) / 2
    });

    it('should handle empty orders gracefully', async () => {
      prisma.execucaoPlanejamento.findUnique.mockResolvedValue({
        id: mockExecucaoId,
      });
      prisma.ordemPlanejada.findMany.mockResolvedValue([]);

      const result = await service.getPanelData(mockExecucaoId);

      expect(result.urgentActions).toHaveLength(0);
      expect(result.supplierSummary).toHaveLength(0);
      expect(result.totals.totalPurchaseCost).toBe(0);
      expect(result.totals.totalOrders).toBe(0);
      expect(result.totals.urgentOrders).toBe(0);
      expect(result.totals.averageLeadTimeDays).toBe(0);
    });

    it('should handle orders with null fornecedorId', async () => {
      prisma.execucaoPlanejamento.findUnique.mockResolvedValue({
        id: mockExecucaoId,
      });

      const orderWithoutSupplier = createMockOrder({
        id: 'order-no-supplier',
        fornecedorId: null,
        fornecedor: null,
        dataLiberacao: new Date('2026-02-28'),
      });

      prisma.ordemPlanejada.findMany.mockResolvedValue([
        orderWithoutSupplier,
      ]);

      const result = await service.getPanelData(mockExecucaoId);

      expect(result.urgentActions).toHaveLength(1);
      expect(result.urgentActions[0].fornecedorNome).toBe('Sem fornecedor');

      expect(result.supplierSummary).toHaveLength(1);
      expect(result.supplierSummary[0].fornecedorId).toBe('SEM_FORNECEDOR');
      expect(result.supplierSummary[0].fornecedorNome).toBe('Sem fornecedor');
    });

    it('should include correct fields in each urgent action', async () => {
      prisma.execucaoPlanejamento.findUnique.mockResolvedValue({
        id: mockExecucaoId,
      });

      const order = createMockOrder({
        id: 'order-detail',
        dataLiberacao: new Date('2026-02-28'),
        dataNecessidade: new Date('2026-03-05'),
        quantidade: 250,
        custoEstimado: 12500,
        prioridade: 'CRITICA',
        mensagemAcao: 'LIBERAR',
        produto: { codigo: 'MAT-100', descricao: 'Material Premium' },
        fornecedor: {
          id: 'forn-x',
          razaoSocial: 'Mega Fornecedor',
          leadTimePadraoDias: 7,
        },
      });

      prisma.ordemPlanejada.findMany.mockResolvedValue([order]);

      const result = await service.getPanelData(mockExecucaoId);

      const action = result.urgentActions[0];
      expect(action.orderId).toBe('order-detail');
      expect(action.produtoCodigo).toBe('MAT-100');
      expect(action.produtoDescricao).toBe('Material Premium');
      expect(action.quantidade).toBe(250);
      expect(action.fornecedorNome).toBe('Mega Fornecedor');
      expect(action.dataLiberacao).toBe('2026-02-28');
      expect(action.dataNecessidade).toBe('2026-03-05');
      expect(action.custoEstimado).toBe(12500);
      expect(action.prioridade).toBe('CRITICA');
      expect(action.mensagemAcao).toBe('LIBERAR');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // getExportData
  // ────────────────────────────────────────────────────────────────

  describe('getExportData', () => {
    it('should generate and return an Excel buffer', async () => {
      prisma.execucaoPlanejamento.findUnique.mockResolvedValue({
        id: mockExecucaoId,
      });
      prisma.ordemPlanejada.findMany.mockResolvedValue([]);

      const mockBuffer = Buffer.from('excel-data');
      excelExportService.generatePurchasingReport.mockResolvedValue(
        mockBuffer,
      );

      const result = await service.getExportData(mockExecucaoId);

      expect(result).toEqual(mockBuffer);
      expect(
        excelExportService.generatePurchasingReport,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          execucaoId: mockExecucaoId,
        }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // sendEmailSummary
  // ────────────────────────────────────────────────────────────────

  describe('sendEmailSummary', () => {
    it('should return success with recipients', async () => {
      prisma.execucaoPlanejamento.findUnique.mockResolvedValue({
        id: mockExecucaoId,
      });
      prisma.ordemPlanejada.findMany.mockResolvedValue([]);
      prisma.configSistema.findUnique.mockResolvedValue({
        chave: 'mrp.purchasing_email_recipients',
        valor: ['compras@test.com', 'manager@test.com'],
      });

      const result = await service.sendEmailSummary(mockExecucaoId);

      expect(result.sent).toBe(true);
      expect(result.recipients).toEqual([
        'compras@test.com',
        'manager@test.com',
      ]);
    });

    it('should use fallback recipients when config is missing', async () => {
      prisma.execucaoPlanejamento.findUnique.mockResolvedValue({
        id: mockExecucaoId,
      });
      prisma.ordemPlanejada.findMany.mockResolvedValue([]);
      prisma.configSistema.findUnique.mockResolvedValue(null);

      const result = await service.sendEmailSummary(mockExecucaoId);

      expect(result.sent).toBe(true);
      expect(result.recipients).toEqual(['compras@empresa.com']);
    });

    it('should handle config read errors gracefully', async () => {
      prisma.execucaoPlanejamento.findUnique.mockResolvedValue({
        id: mockExecucaoId,
      });
      prisma.ordemPlanejada.findMany.mockResolvedValue([]);
      prisma.configSistema.findUnique.mockRejectedValue(
        new Error('DB error'),
      );

      const result = await service.sendEmailSummary(mockExecucaoId);

      expect(result.sent).toBe(true);
      expect(result.recipients).toEqual(['compras@empresa.com']);
    });
  });
});
