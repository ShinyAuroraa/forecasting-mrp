import { Test, TestingModule } from '@nestjs/testing';
import { EmailAggregatorService } from '../email-aggregator.service';
import { PrismaService } from '../../../../prisma/prisma.service';

const mockPrisma = {
  notificacao: { findMany: jest.fn() },
  ordemPlanejada: { findMany: jest.fn() },
  eventoCapacidade: { findMany: jest.fn() },
  forecastMetrica: { findMany: jest.fn() },
  execucaoPlanejamento: { findUnique: jest.fn() },
};

describe('EmailAggregatorService', () => {
  let service: EmailAggregatorService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailAggregatorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<EmailAggregatorService>(EmailAggregatorService);
  });

  describe('aggregateDailySummary', () => {
    it('should aggregate data from all sources in parallel', async () => {
      mockPrisma.notificacao.findMany.mockResolvedValue([]);
      mockPrisma.ordemPlanejada.findMany.mockResolvedValue([]);
      mockPrisma.eventoCapacidade.findMany.mockResolvedValue([]);
      mockPrisma.forecastMetrica.findMany.mockResolvedValue([]);

      const result = await service.aggregateDailySummary();

      expect(result.date).toBeTruthy();
      expect(result.stockAlerts).toBeDefined();
      expect(result.urgentPurchases).toBeDefined();
      expect(result.capacity).toBeDefined();
      expect(result.forecastAccuracy).toBeDefined();
      expect(result.pipelineSummary).toBeNull();
    });

    it('should include pipeline summary when executionId provided', async () => {
      mockPrisma.notificacao.findMany.mockResolvedValue([]);
      mockPrisma.ordemPlanejada.findMany.mockResolvedValue([]);
      mockPrisma.eventoCapacidade.findMany.mockResolvedValue([]);
      mockPrisma.forecastMetrica.findMany.mockResolvedValue([]);
      mockPrisma.execucaoPlanejamento.findUnique.mockResolvedValue({
        id: 'exec-1',
        resultadoResumo: { stepsCompleted: 5, stepsFailed: 1, stepsSkipped: 1, totalDurationMs: 3000 },
      });

      const result = await service.aggregateDailySummary('exec-1');

      expect(result.pipelineSummary).toEqual({
        stepsCompleted: 5,
        stepsFailed: 1,
        stepsSkipped: 1,
        durationMs: 3000,
      });
    });

    it('should handle stock alerts with critical SKUs', async () => {
      mockPrisma.notificacao.findMany.mockResolvedValue([
        {
          severidade: 'CRITICAL',
          entityId: 'SKU-001',
          titulo: 'Estoque critico',
          metadata: { subtype: 'below_safety_stock', currentStock: 5, safetyStock: 20, reorderPoint: 30 },
          produto: { codigo: 'SKU-001', descricao: 'Produto A' },
        },
        {
          severidade: 'HIGH',
          entityId: 'SKU-002',
          titulo: 'Proximo PR',
          metadata: { subtype: 'approaching_rop', currentStock: 25, safetyStock: 10, reorderPoint: 30 },
          produto: { codigo: 'SKU-002', descricao: 'Produto B' },
        },
      ]);
      mockPrisma.ordemPlanejada.findMany.mockResolvedValue([]);
      mockPrisma.eventoCapacidade.findMany.mockResolvedValue([]);
      mockPrisma.forecastMetrica.findMany.mockResolvedValue([]);

      const result = await service.aggregateDailySummary();

      expect(result.stockAlerts.belowSafetyStock).toBe(1);
      expect(result.stockAlerts.approachingRop).toBe(1);
      expect(result.stockAlerts.criticalSkus).toHaveLength(2);
      expect(result.stockAlerts.criticalSkus[0].codigo).toBe('SKU-001');
    });

    it('should handle urgent purchases grouped by supplier', async () => {
      mockPrisma.notificacao.findMany.mockResolvedValue([]);
      mockPrisma.ordemPlanejada.findMany.mockResolvedValue([
        { custoEstimado: 1000, fornecedor: { razaoSocial: 'Fornecedor A' } },
        { custoEstimado: 2000, fornecedor: { razaoSocial: 'Fornecedor A' } },
        { custoEstimado: 500, fornecedor: { razaoSocial: 'Fornecedor B' } },
      ]);
      mockPrisma.eventoCapacidade.findMany.mockResolvedValue([]);
      mockPrisma.forecastMetrica.findMany.mockResolvedValue([]);

      const result = await service.aggregateDailySummary();

      expect(result.urgentPurchases.orderCount).toBe(3);
      expect(result.urgentPurchases.totalValue).toBe(3500);
      expect(result.urgentPurchases.topSuppliers).toHaveLength(2);
      expect(result.urgentPurchases.topSuppliers[0].fornecedorNome).toBe('Fornecedor A');
      expect(result.urgentPurchases.topSuppliers[0].valorTotal).toBe(3000);
    });

    it('should handle capacity overloaded centers', async () => {
      mockPrisma.notificacao.findMany.mockResolvedValue([]);
      mockPrisma.ordemPlanejada.findMany.mockResolvedValue([]);
      mockPrisma.eventoCapacidade.findMany.mockResolvedValue([
        { utilizacaoPct: 115, centroTrabalho: { nome: 'Linha 1' } },
        { utilizacaoPct: 90, centroTrabalho: { nome: 'Linha 2' } },
        { utilizacaoPct: 50, centroTrabalho: { nome: 'Linha 3' } },
      ]);
      mockPrisma.forecastMetrica.findMany.mockResolvedValue([]);

      const result = await service.aggregateDailySummary();

      expect(result.capacity.overloadedCenters).toHaveLength(2);
      expect(result.capacity.overloadedCenters[0].status).toBe('OVERLOADED');
      expect(result.capacity.overloadedCenters[1].status).toBe('WARNING');
      expect(result.capacity.totalOverloadAlerts).toBe(1);
    });

    it('should gracefully degrade if a section throws', async () => {
      mockPrisma.notificacao.findMany.mockRejectedValue(new Error('DB error'));
      mockPrisma.ordemPlanejada.findMany.mockResolvedValue([]);
      mockPrisma.eventoCapacidade.findMany.mockResolvedValue([]);
      mockPrisma.forecastMetrica.findMany.mockResolvedValue([]);

      const result = await service.aggregateDailySummary();

      // Stock alerts failed → returns empty defaults
      expect(result.stockAlerts.belowSafetyStock).toBe(0);
      expect(result.stockAlerts.criticalSkus).toEqual([]);
      // Other sections unaffected
      expect(result.urgentPurchases).toBeDefined();
    });

    it('should compute forecast accuracy by ABC class', async () => {
      const now = new Date();
      mockPrisma.notificacao.findMany.mockResolvedValue([]);
      mockPrisma.ordemPlanejada.findMany.mockResolvedValue([]);
      mockPrisma.eventoCapacidade.findMany.mockResolvedValue([]);
      mockPrisma.forecastMetrica.findMany.mockResolvedValue([
        { mape: 5.0, classeAbc: 'A', createdAt: new Date(now.getTime() - 2 * 86400000) },
        { mape: 7.0, classeAbc: 'A', createdAt: new Date(now.getTime() - 2 * 86400000) },
        { mape: 12.0, classeAbc: 'B', createdAt: new Date(now.getTime() - 2 * 86400000) },
      ]);

      const result = await service.aggregateDailySummary();

      expect(result.forecastAccuracy.byClass['A']).toBe(6);
      expect(result.forecastAccuracy.byClass['B']).toBe(12);
    });
  });
});
