import { Test } from '@nestjs/testing';
import { DashboardService } from '../dashboard.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      serieTemporal: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { receita: null } }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      forecastMetrica: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      skuClassification: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      ordemPlanejada: {
        count: jest.fn().mockResolvedValue(0),
      },
      forecastResultado: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      parametrosEstoque: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      notificacao: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ avg_value: null }]),
    };

    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  // ── KPIs ──────────────────────────────────────

  describe('getKpis', () => {
    it('should return all 4 KPI cards with default values', async () => {
      const result = await service.getKpis();

      expect(result.monthlyRevenue.label).toBe('Receita Mensal');
      expect(result.forecastAccuracy.label).toBe('Acurácia Forecast');
      expect(result.inventoryTurnover.label).toBe('Giro de Estoque');
      expect(result.fillRate.label).toBe('Fill Rate (OTIF)');
      expect(result.referenceDate).toBeDefined();
    });

    it('should compute MoM variation for revenue', async () => {
      prisma.serieTemporal.aggregate
        .mockResolvedValueOnce({ _sum: { receita: 150000 } }) // current
        .mockResolvedValueOnce({ _sum: { receita: 100000 } }); // previous

      const result = await service.getKpis();

      expect(result.monthlyRevenue.value).toBe(150000);
      expect(result.monthlyRevenue.variation.percent).toBe(50);
      expect(result.monthlyRevenue.variation.direction).toBe('up');
    });

    it('should compute weighted MAPE for forecast accuracy', async () => {
      prisma.forecastMetrica.findMany.mockResolvedValue([
        { mape: 10, produtoId: 'p1' },
        { mape: 20, produtoId: 'p2' },
      ]);
      prisma.skuClassification.findMany.mockResolvedValue([
        { produtoId: 'p1', percentualReceita: 0.6 },
        { produtoId: 'p2', percentualReceita: 0.4 },
      ]);

      const result = await service.getKpis();

      // weightedMAPE = (10*0.6 + 20*0.4) / (0.6+0.4) = 14
      // accuracy = 100 - 14 = 86
      expect(result.forecastAccuracy.value).toBe(86);
    });

    it('should compute inventory turnover', async () => {
      prisma.serieTemporal.aggregate.mockResolvedValue({ _sum: { receita: 1000000 } });
      prisma.$queryRaw.mockResolvedValue([{ avg_value: 200000 }]);

      const result = await service.getKpis();

      expect(result.inventoryTurnover.value).toBe(5);
    });

    it('should compute fill rate from order statuses', async () => {
      prisma.ordemPlanejada.count
        .mockResolvedValueOnce(100) // total non-PLANEJADA
        .mockResolvedValueOnce(75); // FINALIZADA

      const result = await service.getKpis();

      expect(result.fillRate.value).toBe(75);
    });
  });

  // ── Revenue Chart ─────────────────────────────

  describe('getRevenueChart', () => {
    it('should return empty points when no data', async () => {
      const result = await service.getRevenueChart();

      expect(result.points).toEqual([]);
      expect(result.divergenceFlags).toEqual([]);
    });

    it('should map actuals and forecasts into points', async () => {
      prisma.serieTemporal.groupBy.mockResolvedValue([
        { dataReferencia: new Date('2025-11-01'), _sum: { receita: 100000 } },
        { dataReferencia: new Date('2025-12-01'), _sum: { receita: 120000 } },
      ]);

      const result = await service.getRevenueChart();

      expect(result.points.length).toBe(2);
      expect(result.points[0].actual).toBe(100000);
      expect(result.points[0].forecastIndirect).toBeNull();
    });

    it('should flag divergence when indirect vs direct > 15%', async () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);

      prisma.forecastResultado.findMany.mockResolvedValue([
        { periodo: futureDate, targetType: 'VOLUME', p10: 80, p50: 100, p90: 120, faturamentoP50: null, faturamentoP10: null, faturamentoP90: null },
        { periodo: futureDate, targetType: 'FATURAMENTO', p10: null, p50: null, p90: null, faturamentoP50: 70, faturamentoP10: 50, faturamentoP90: 90 },
      ]);

      const result = await service.getRevenueChart();

      // 100 vs 70 = 30% divergence
      expect(result.divergenceFlags.length).toBe(1);
      expect(result.divergenceFlags[0].divergencePercent).toBeGreaterThan(15);
    });
  });

  // ── Pareto ────────────────────────────────────

  describe('getPareto', () => {
    it('should group by ABC class', async () => {
      prisma.skuClassification.findMany.mockResolvedValue([
        { classeAbc: 'A', percentualReceita: 0.5, produto: { id: '1' } },
        { classeAbc: 'A', percentualReceita: 0.3, produto: { id: '2' } },
        { classeAbc: 'B', percentualReceita: 0.15, produto: { id: '3' } },
        { classeAbc: 'C', percentualReceita: 0.05, produto: { id: '4' } },
      ]);

      const result = await service.getPareto();

      expect(result.items.length).toBe(3);
      expect(result.items[0].classeAbc).toBe('A');
      expect(result.items[0].skuCount).toBe(2);
      expect(result.items[2].cumulativePercent).toBeCloseTo(100, 0);
    });

    it('should handle empty classification', async () => {
      const result = await service.getPareto();

      expect(result.items).toEqual([]);
      expect(result.totalRevenue).toBe(0);
    });
  });

  // ── Stock Coverage ────────────────────────────

  describe('getStockCoverage', () => {
    it('should map coverage days to color zones', async () => {
      prisma.skuClassification.findMany.mockResolvedValue([
        { produtoId: 'p1', classeAbc: 'A', produto: { id: 'p1', codigo: 'SKU-001', descricao: 'Prod A' } },
      ]);
      prisma.parametrosEstoque.findMany.mockResolvedValue([
        { produtoId: 'p1', diasCoberturaAtual: 5 },
      ]);

      const result = await service.getStockCoverage();

      expect(result.items.length).toBe(1);
      expect(result.items[0].colorZone).toBe('red');
      expect(result.items[0].coverageDays).toBe(5);
    });

    it('should apply color thresholds correctly', async () => {
      prisma.skuClassification.findMany.mockResolvedValue([
        { produtoId: 'p1', classeAbc: 'A', produto: { id: 'p1', codigo: 'S1', descricao: 'A' } },
        { produtoId: 'p2', classeAbc: 'A', produto: { id: 'p2', codigo: 'S2', descricao: 'B' } },
        { produtoId: 'p3', classeAbc: 'B', produto: { id: 'p3', codigo: 'S3', descricao: 'C' } },
        { produtoId: 'p4', classeAbc: 'B', produto: { id: 'p4', codigo: 'S4', descricao: 'D' } },
      ]);
      prisma.parametrosEstoque.findMany.mockResolvedValue([
        { produtoId: 'p1', diasCoberturaAtual: 3 },
        { produtoId: 'p2', diasCoberturaAtual: 10 },
        { produtoId: 'p3', diasCoberturaAtual: 20 },
        { produtoId: 'p4', diasCoberturaAtual: 45 },
      ]);

      const result = await service.getStockCoverage();

      expect(result.items[0].colorZone).toBe('red');    // 3 < 7
      expect(result.items[1].colorZone).toBe('orange');  // 10 >= 7 && < 14
      expect(result.items[2].colorZone).toBe('yellow');  // 20 >= 14 && < 30
      expect(result.items[3].colorZone).toBe('green');   // 45 >= 30
    });
  });

  // ── Active Alerts ─────────────────────────────

  describe('getActiveAlerts', () => {
    it('should return active alerts grouped by type', async () => {
      prisma.notificacao.groupBy.mockResolvedValue([
        { tipo: 'STOCKOUT', _count: { id: 5 } },
        { tipo: 'CAPACITY_OVERLOAD', _count: { id: 2 } },
      ]);

      const result = await service.getActiveAlerts();

      expect(result.total).toBe(7);
      expect(result.categories.length).toBe(2);
      expect(result.categories[0].label).toBe('SKUs em Stockout');
    });

    it('should return 0 total when no alerts', async () => {
      const result = await service.getActiveAlerts();

      expect(result.total).toBe(0);
      expect(result.categories).toEqual([]);
    });
  });
});
