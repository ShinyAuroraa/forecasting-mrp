import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../prisma/prisma.service';
import { MpsService } from './mps.service';

/**
 * Unit tests for MpsService — Master Production Schedule Generation
 *
 * Test cases cover all 11 ACs from Story 3.6:
 * - AC-1: MPS for all ACABADO products over configurable horizon
 * - AC-2: demand = MAX(forecast_P50, firm_orders) within firm horizon
 * - AC-3: Firm-order horizon configurable (2-4 weeks)
 * - AC-4: Beyond firm horizon, demand = forecast only
 * - AC-5: Forecast from latest CONCLUIDO execution (VOLUME, P50)
 * - AC-6: Firm orders from OrdemPlanejada (FIRME, PRODUCAO)
 * - AC-7: Output is Map<produtoId, MpsProductResult>
 * - AC-8: No forecast -> firm orders only + warning
 * - AC-9: No firm orders -> forecast only
 * - AC-10: Logs products processed and total demand
 * - AC-11: >= 80% coverage
 *
 * @see Story 3.6 — Master Production Schedule
 * @see FR-034 — MPS Generation
 */
describe('MpsService', () => {
  let service: MpsService;

  // ────────────────────────────────────────────────────────────────
  // Mock Setup
  // ────────────────────────────────────────────────────────────────

  const mockPrismaService = {
    configSistema: { findMany: jest.fn() },
    produto: { findMany: jest.fn() },
    execucaoPlanejamento: { findFirst: jest.fn() },
    forecastResultado: { findMany: jest.fn() },
    ordemPlanejada: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MpsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MpsService>(MpsService);
  });

  // ────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────

  /** Create a mock Prisma Decimal */
  const mockDecimal = (value: number) => ({
    toNumber: () => value,
    toString: () => String(value),
    valueOf: () => value,
  });

  /** Monday 2026-03-02 00:00 UTC (ISO week start) */
  const PLANNING_START = new Date(Date.UTC(2026, 2, 2, 0, 0, 0, 0));

  /** Standard set of active ACABADO products */
  const PRODUCTS = [
    { id: 'prod-A', codigo: 'SKU-A001', descricao: 'Finished Product A' },
    { id: 'prod-B', codigo: 'SKU-B002', descricao: 'Finished Product B' },
  ];

  /** Setup default mocks for a standard MPS generation */
  const setupDefaults = (overrides?: {
    configs?: { chave: string; valor: unknown }[];
    products?: { id: string; codigo: string; descricao: string }[];
    latestExecution?: { id: string } | null;
    forecastResults?: {
      produtoId: string;
      periodo: Date;
      p50: ReturnType<typeof mockDecimal> | null;
    }[];
    firmOrders?: {
      produtoId: string;
      dataNecessidade: Date;
      quantidade: ReturnType<typeof mockDecimal>;
    }[];
  }) => {
    mockPrismaService.configSistema.findMany.mockResolvedValue(
      overrides?.configs ?? [],
    );

    mockPrismaService.produto.findMany.mockResolvedValue(
      overrides?.products ?? PRODUCTS,
    );

    mockPrismaService.execucaoPlanejamento.findFirst.mockResolvedValue(
      overrides?.latestExecution !== undefined
        ? overrides.latestExecution
        : { id: 'exec-001' },
    );

    mockPrismaService.forecastResultado.findMany.mockResolvedValue(
      overrides?.forecastResults ?? [],
    );

    mockPrismaService.ordemPlanejada.findMany.mockResolvedValue(
      overrides?.firmOrders ?? [],
    );
  };

  // ────────────────────────────────────────────────────────────────
  // getStartOfWeek
  // ────────────────────────────────────────────────────────────────

  describe('getStartOfWeek', () => {
    it('should return Monday for a Monday date', () => {
      const monday = new Date(Date.UTC(2026, 2, 2)); // March 2, 2026 = Monday
      const result = service.getStartOfWeek(monday);
      expect(result.getUTCDay()).toBe(1); // Monday
      expect(result.getTime()).toBe(monday.getTime());
    });

    it('should return previous Monday for a Wednesday', () => {
      const wednesday = new Date(Date.UTC(2026, 2, 4)); // March 4, 2026 = Wednesday
      const result = service.getStartOfWeek(wednesday);
      expect(result.getUTCDay()).toBe(1);
      expect(result.getUTCDate()).toBe(2); // Monday March 2
    });

    it('should return previous Monday for a Sunday', () => {
      const sunday = new Date(Date.UTC(2026, 2, 8)); // March 8, 2026 = Sunday
      const result = service.getStartOfWeek(sunday);
      expect(result.getUTCDay()).toBe(1);
      expect(result.getUTCDate()).toBe(2); // Monday March 2
    });

    it('should return previous Monday for a Saturday', () => {
      const saturday = new Date(Date.UTC(2026, 2, 7)); // March 7, 2026 = Saturday
      const result = service.getStartOfWeek(saturday);
      expect(result.getUTCDay()).toBe(1);
      expect(result.getUTCDate()).toBe(2); // Monday March 2
    });

    it('should strip time component to 00:00 UTC', () => {
      const dateWithTime = new Date(Date.UTC(2026, 2, 4, 15, 30, 45));
      const result = service.getStartOfWeek(dateWithTime);
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // generateWeeklyBuckets
  // ────────────────────────────────────────────────────────────────

  describe('generateWeeklyBuckets', () => {
    it('should generate 13 weekly buckets by default (AC-1)', () => {
      const buckets = service.generateWeeklyBuckets(PLANNING_START, 13);

      expect(buckets).toHaveLength(13);
    });

    it('should align first bucket to Monday and last to Sunday', () => {
      const buckets = service.generateWeeklyBuckets(PLANNING_START, 1);

      expect(buckets[0].periodStart.getUTCDay()).toBe(1); // Monday
      expect(buckets[0].periodEnd.getUTCDay()).toBe(0); // Sunday
    });

    it('should have consecutive non-overlapping weeks', () => {
      const buckets = service.generateWeeklyBuckets(PLANNING_START, 4);

      for (let i = 1; i < buckets.length; i++) {
        const prevEnd = buckets[i - 1].periodEnd.getTime();
        const currStart = buckets[i].periodStart.getTime();
        // Next period starts after previous period ends
        expect(currStart).toBeGreaterThan(prevEnd);
        // Gap should be < 1 second (just the 23:59:59.999 to 00:00:00.000 boundary)
        expect(currStart - prevEnd).toBeLessThan(1000);
      }
    });

    it('should handle 0 weeks', () => {
      const buckets = service.generateWeeklyBuckets(PLANNING_START, 0);
      expect(buckets).toHaveLength(0);
    });

    it('should set periodEnd to Sunday 23:59:59.999', () => {
      const buckets = service.generateWeeklyBuckets(PLANNING_START, 1);

      expect(buckets[0].periodEnd.getUTCHours()).toBe(23);
      expect(buckets[0].periodEnd.getUTCMinutes()).toBe(59);
      expect(buckets[0].periodEnd.getUTCSeconds()).toBe(59);
      expect(buckets[0].periodEnd.getUTCMilliseconds()).toBe(999);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // loadConfig
  // ────────────────────────────────────────────────────────────────

  describe('loadConfig', () => {
    it('should return defaults when no ConfigSistema entries exist (AC-11 test #11)', async () => {
      mockPrismaService.configSistema.findMany.mockResolvedValue([]);

      const config = await service.loadConfig();

      expect(config.planningHorizonWeeks).toBe(13);
      expect(config.firmOrderHorizonWeeks).toBe(2);
    });

    it('should use ConfigSistema values when present', async () => {
      mockPrismaService.configSistema.findMany.mockResolvedValue([
        { chave: 'mrp.planning_horizon_weeks', valor: 16 },
        { chave: 'mrp.firm_order_horizon_weeks', valor: 4 },
      ]);

      const config = await service.loadConfig();

      expect(config.planningHorizonWeeks).toBe(16);
      expect(config.firmOrderHorizonWeeks).toBe(4);
    });

    it('should handle valor as string', async () => {
      mockPrismaService.configSistema.findMany.mockResolvedValue([
        { chave: 'mrp.planning_horizon_weeks', valor: '10' },
      ]);

      const config = await service.loadConfig();

      expect(config.planningHorizonWeeks).toBe(10);
    });

    it('should handle valor as JSON object with value key', async () => {
      mockPrismaService.configSistema.findMany.mockResolvedValue([
        { chave: 'mrp.firm_order_horizon_weeks', valor: { value: 3 } },
      ]);

      const config = await service.loadConfig();

      expect(config.firmOrderHorizonWeeks).toBe(3);
    });

    it('should fallback to default for non-parseable valor', async () => {
      mockPrismaService.configSistema.findMany.mockResolvedValue([
        { chave: 'mrp.planning_horizon_weeks', valor: { nested: { deep: true } } },
      ]);

      const config = await service.loadConfig();

      expect(config.planningHorizonWeeks).toBe(13);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // loadFinishedProducts
  // ────────────────────────────────────────────────────────────────

  describe('loadFinishedProducts', () => {
    it('should query for ACABADO and ativo=true products', async () => {
      mockPrismaService.produto.findMany.mockResolvedValue(PRODUCTS);

      const products = await service.loadFinishedProducts();

      expect(mockPrismaService.produto.findMany).toHaveBeenCalledWith({
        where: { tipoProduto: 'ACABADO', ativo: true },
        select: { id: true, codigo: true, descricao: true },
      });
      expect(products).toHaveLength(2);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // loadLatestForecastData
  // ────────────────────────────────────────────────────────────────

  describe('loadLatestForecastData', () => {
    it('should find the latest CONCLUIDO forecast execution (AC-5)', async () => {
      mockPrismaService.execucaoPlanejamento.findFirst.mockResolvedValue({
        id: 'exec-latest',
      });
      mockPrismaService.forecastResultado.findMany.mockResolvedValue([]);

      await service.loadLatestForecastData(['prod-A']);

      expect(
        mockPrismaService.execucaoPlanejamento.findFirst,
      ).toHaveBeenCalledWith({
        where: { tipo: 'FORECAST', status: 'CONCLUIDO' },
        orderBy: { completedAt: 'desc' },
        select: { id: true },
      });
    });

    it('should return empty map when no CONCLUIDO execution exists (AC-11 test #12)', async () => {
      mockPrismaService.execucaoPlanejamento.findFirst.mockResolvedValue(null);

      const result = await service.loadLatestForecastData(['prod-A']);

      expect(result.size).toBe(0);
    });

    it('should load VOLUME forecast results and group by product and week', async () => {
      mockPrismaService.execucaoPlanejamento.findFirst.mockResolvedValue({
        id: 'exec-001',
      });
      mockPrismaService.forecastResultado.findMany.mockResolvedValue([
        {
          produtoId: 'prod-A',
          periodo: new Date(Date.UTC(2026, 2, 2)),
          p50: mockDecimal(100),
        },
        {
          produtoId: 'prod-A',
          periodo: new Date(Date.UTC(2026, 2, 9)),
          p50: mockDecimal(120),
        },
        {
          produtoId: 'prod-B',
          periodo: new Date(Date.UTC(2026, 2, 2)),
          p50: mockDecimal(80),
        },
      ]);

      const result = await service.loadLatestForecastData([
        'prod-A',
        'prod-B',
      ]);

      expect(result.size).toBe(2);
      expect(result.get('prod-A')?.size).toBe(2);
      expect(result.get('prod-B')?.size).toBe(1);

      const week1Timestamp = PLANNING_START.getTime();
      expect(result.get('prod-A')?.get(week1Timestamp)).toBe(100);
      expect(result.get('prod-B')?.get(week1Timestamp)).toBe(80);
    });

    it('should handle null p50 values', async () => {
      mockPrismaService.execucaoPlanejamento.findFirst.mockResolvedValue({
        id: 'exec-001',
      });
      mockPrismaService.forecastResultado.findMany.mockResolvedValue([
        {
          produtoId: 'prod-A',
          periodo: new Date(Date.UTC(2026, 2, 2)),
          p50: null,
        },
      ]);

      const result = await service.loadLatestForecastData(['prod-A']);

      const week1Timestamp = PLANNING_START.getTime();
      expect(result.get('prod-A')?.get(week1Timestamp)).toBe(0);
    });

    it('should return empty map for empty productIds array', async () => {
      const result = await service.loadLatestForecastData([]);

      expect(result.size).toBe(0);
      expect(
        mockPrismaService.execucaoPlanejamento.findFirst,
      ).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // loadFirmOrders
  // ────────────────────────────────────────────────────────────────

  describe('loadFirmOrders', () => {
    it('should query FIRME + PRODUCAO orders within date range (AC-6)', async () => {
      const start = new Date(Date.UTC(2026, 2, 2));
      const end = new Date(Date.UTC(2026, 4, 31));

      mockPrismaService.ordemPlanejada.findMany.mockResolvedValue([]);

      await service.loadFirmOrders(['prod-A'], start, end);

      expect(mockPrismaService.ordemPlanejada.findMany).toHaveBeenCalledWith({
        where: {
          status: 'FIRME',
          tipo: 'PRODUCAO',
          produtoId: { in: ['prod-A'] },
          dataNecessidade: { gte: start, lte: end },
        },
        select: {
          produtoId: true,
          dataNecessidade: true,
          quantidade: true,
        },
      });
    });

    it('should group firm orders by product and week', async () => {
      mockPrismaService.ordemPlanejada.findMany.mockResolvedValue([
        {
          produtoId: 'prod-A',
          dataNecessidade: new Date(Date.UTC(2026, 2, 3)), // Tuesday week 1
          quantidade: mockDecimal(50),
        },
        {
          produtoId: 'prod-A',
          dataNecessidade: new Date(Date.UTC(2026, 2, 5)), // Thursday week 1
          quantidade: mockDecimal(30),
        },
        {
          produtoId: 'prod-A',
          dataNecessidade: new Date(Date.UTC(2026, 2, 10)), // Tuesday week 2
          quantidade: mockDecimal(70),
        },
      ]);

      const result = await service.loadFirmOrders(
        ['prod-A'],
        new Date(Date.UTC(2026, 2, 2)),
        new Date(Date.UTC(2026, 2, 15)),
      );

      const week1Timestamp = PLANNING_START.getTime();
      const week2Timestamp = new Date(Date.UTC(2026, 2, 9)).getTime();

      // Week 1: 50 + 30 = 80
      expect(result.get('prod-A')?.get(week1Timestamp)).toBe(80);
      // Week 2: 70
      expect(result.get('prod-A')?.get(week2Timestamp)).toBe(70);
    });

    it('should return empty map for empty productIds', async () => {
      const result = await service.loadFirmOrders(
        [],
        new Date(),
        new Date(),
      );

      expect(result.size).toBe(0);
      expect(
        mockPrismaService.ordemPlanejada.findMany,
      ).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // calculateDemand — Core MAX rule tests
  // ────────────────────────────────────────────────────────────────

  describe('calculateDemand', () => {
    const weeklyBuckets = [
      {
        periodStart: new Date(Date.UTC(2026, 2, 2)),
        periodEnd: new Date(Date.UTC(2026, 2, 8, 23, 59, 59, 999)),
      },
      {
        periodStart: new Date(Date.UTC(2026, 2, 9)),
        periodEnd: new Date(Date.UTC(2026, 2, 15, 23, 59, 59, 999)),
      },
      {
        periodStart: new Date(Date.UTC(2026, 2, 16)),
        periodEnd: new Date(Date.UTC(2026, 2, 22, 23, 59, 59, 999)),
      },
      {
        periodStart: new Date(Date.UTC(2026, 2, 23)),
        periodEnd: new Date(Date.UTC(2026, 2, 29, 23, 59, 59, 999)),
      },
    ];

    const week1 = weeklyBuckets[0].periodStart.getTime();
    const week2 = weeklyBuckets[1].periodStart.getTime();
    const week3 = weeklyBuckets[2].periodStart.getTime();
    const week4 = weeklyBuckets[3].periodStart.getTime();

    it('AC-2 test #1: demand = MAX(forecast, firmOrders) when both exist within firm horizon', () => {
      const forecastData = new Map<number, number>([
        [week1, 100],
        [week2, 80],
      ]);
      const firmOrderData = new Map<number, number>([
        [week1, 120],
        [week2, 60],
      ]);

      const { demandBuckets } = service.calculateDemand(
        weeklyBuckets,
        forecastData,
        firmOrderData,
        2, // firm horizon = 2 weeks
        'prod-A',
        'SKU-A001',
      );

      // Week 1: MAX(100, 120) = 120 (firm > forecast)
      expect(demandBuckets[0].mpsDemand).toBe(120);
      // Week 2: MAX(80, 60) = 80 (forecast > firm)
      expect(demandBuckets[1].mpsDemand).toBe(80);
    });

    it('AC-2 test #2: firm order > forecast within firm horizon', () => {
      const forecastData = new Map<number, number>([[week1, 50]]);
      const firmOrderData = new Map<number, number>([[week1, 200]]);

      const { demandBuckets } = service.calculateDemand(
        weeklyBuckets,
        forecastData,
        firmOrderData,
        2,
        'prod-A',
        'SKU-A001',
      );

      expect(demandBuckets[0].mpsDemand).toBe(200);
      expect(demandBuckets[0].forecastDemand).toBe(50);
      expect(demandBuckets[0].firmOrderDemand).toBe(200);
    });

    it('AC-2 test #3: forecast > firm order within firm horizon', () => {
      const forecastData = new Map<number, number>([[week1, 300]]);
      const firmOrderData = new Map<number, number>([[week1, 150]]);

      const { demandBuckets } = service.calculateDemand(
        weeklyBuckets,
        forecastData,
        firmOrderData,
        2,
        'prod-A',
        'SKU-A001',
      );

      expect(demandBuckets[0].mpsDemand).toBe(300);
    });

    it('AC-4: beyond firm horizon, demand = forecast only (firm orders ignored)', () => {
      const forecastData = new Map<number, number>([
        [week1, 100],
        [week2, 100],
        [week3, 100],
        [week4, 100],
      ]);
      const firmOrderData = new Map<number, number>([
        [week1, 200],
        [week2, 200],
        [week3, 500], // this should be IGNORED (beyond horizon)
        [week4, 500], // this should be IGNORED (beyond horizon)
      ]);

      const { demandBuckets } = service.calculateDemand(
        weeklyBuckets,
        forecastData,
        firmOrderData,
        2, // firm horizon = 2 weeks (weeks 0 and 1)
        'prod-A',
        'SKU-A001',
      );

      // Weeks 0-1 (within firm horizon): MAX rule
      expect(demandBuckets[0].mpsDemand).toBe(200);
      expect(demandBuckets[1].mpsDemand).toBe(200);
      // Weeks 2-3 (beyond firm horizon): forecast only
      expect(demandBuckets[2].mpsDemand).toBe(100);
      expect(demandBuckets[3].mpsDemand).toBe(100);
      // But firmOrderDemand is still populated in the bucket for transparency
      expect(demandBuckets[2].firmOrderDemand).toBe(500);
      expect(demandBuckets[3].firmOrderDemand).toBe(500);
    });

    it('AC-8: no forecast for product — uses firm orders only with warning', () => {
      const forecastData = new Map<number, number>(); // empty
      const firmOrderData = new Map<number, number>([
        [week1, 150],
        [week2, 100],
      ]);

      const { demandBuckets, warnings } = service.calculateDemand(
        weeklyBuckets,
        forecastData,
        firmOrderData,
        2,
        'prod-A',
        'SKU-A001',
      );

      // Within firm horizon: MAX(0, firmOrder)
      expect(demandBuckets[0].mpsDemand).toBe(150);
      expect(demandBuckets[1].mpsDemand).toBe(100);
      // Beyond firm horizon: forecast only (0)
      expect(demandBuckets[2].mpsDemand).toBe(0);
      expect(demandBuckets[3].mpsDemand).toBe(0);

      // Warning should be generated
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('No forecast data');
      expect(warnings[0]).toContain('SKU-A001');
    });

    it('AC-9: no firm orders for product — uses forecast only', () => {
      const forecastData = new Map<number, number>([
        [week1, 100],
        [week2, 120],
        [week3, 80],
        [week4, 90],
      ]);
      const firmOrderData = new Map<number, number>(); // empty

      const { demandBuckets, warnings } = service.calculateDemand(
        weeklyBuckets,
        forecastData,
        firmOrderData,
        2,
        'prod-A',
        'SKU-A001',
      );

      // Within firm horizon: MAX(forecast, 0) = forecast
      expect(demandBuckets[0].mpsDemand).toBe(100);
      expect(demandBuckets[1].mpsDemand).toBe(120);
      // Beyond firm horizon: forecast only
      expect(demandBuckets[2].mpsDemand).toBe(80);
      expect(demandBuckets[3].mpsDemand).toBe(90);

      // No warning expected for missing firm orders (AC-9 is a normal scenario)
      expect(warnings).toHaveLength(0);
    });

    it('test #7: no data at all — demand = 0 for all periods', () => {
      const forecastData = new Map<number, number>();
      const firmOrderData = new Map<number, number>();

      const { demandBuckets, warnings } = service.calculateDemand(
        weeklyBuckets,
        forecastData,
        firmOrderData,
        2,
        'prod-A',
        'SKU-A001',
      );

      for (const bucket of demandBuckets) {
        expect(bucket.mpsDemand).toBe(0);
        expect(bucket.forecastDemand).toBe(0);
        expect(bucket.firmOrderDemand).toBe(0);
      }

      // Warning for no forecast
      expect(warnings).toHaveLength(1);
    });

    it('test #8: firm order horizon boundary — exact week boundary', () => {
      const forecastData = new Map<number, number>([
        [week1, 50],
        [week2, 50],
        [week3, 50],
      ]);
      const firmOrderData = new Map<number, number>([
        [week1, 200],
        [week2, 200], // last week of firm horizon when firmOrderHorizonWeeks=2
        [week3, 200], // first week BEYOND firm horizon
      ]);

      // firm horizon = 2 means buckets at index 0 and 1 use MAX, index 2+ use forecast
      const { demandBuckets } = service.calculateDemand(
        weeklyBuckets,
        forecastData,
        firmOrderData,
        2,
        'prod-A',
        'SKU-A001',
      );

      // Index 0 (within): MAX(50, 200) = 200
      expect(demandBuckets[0].mpsDemand).toBe(200);
      // Index 1 (within): MAX(50, 200) = 200
      expect(demandBuckets[1].mpsDemand).toBe(200);
      // Index 2 (BEYOND): forecast only = 50
      expect(demandBuckets[2].mpsDemand).toBe(50);
    });

    it('firm order horizon = 0: all weeks use forecast only', () => {
      const forecastData = new Map<number, number>([
        [week1, 50],
        [week2, 50],
      ]);
      const firmOrderData = new Map<number, number>([
        [week1, 200],
        [week2, 200],
      ]);

      const { demandBuckets } = service.calculateDemand(
        weeklyBuckets,
        forecastData,
        firmOrderData,
        0, // no firm horizon
        'prod-A',
        'SKU-A001',
      );

      expect(demandBuckets[0].mpsDemand).toBe(50);
      expect(demandBuckets[1].mpsDemand).toBe(50);
    });

    it('firm order horizon = 4 (full span): all weeks use MAX rule', () => {
      const forecastData = new Map<number, number>([
        [week1, 50],
        [week2, 50],
        [week3, 50],
        [week4, 50],
      ]);
      const firmOrderData = new Map<number, number>([
        [week1, 200],
        [week2, 200],
        [week3, 200],
        [week4, 200],
      ]);

      const { demandBuckets } = service.calculateDemand(
        weeklyBuckets,
        forecastData,
        firmOrderData,
        4, // covers all 4 buckets
        'prod-A',
        'SKU-A001',
      );

      for (const bucket of demandBuckets) {
        expect(bucket.mpsDemand).toBe(200);
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // generateMps — Full integration tests
  // ────────────────────────────────────────────────────────────────

  describe('generateMps', () => {
    it('AC-1: should generate MPS for all ACABADO products over 13-week default horizon', async () => {
      setupDefaults({
        forecastResults: [
          {
            produtoId: 'prod-A',
            periodo: PLANNING_START,
            p50: mockDecimal(100),
          },
          {
            produtoId: 'prod-B',
            periodo: PLANNING_START,
            p50: mockDecimal(200),
          },
        ],
      });

      const result = await service.generateMps({
        startDate: PLANNING_START,
      });

      expect(result.planningHorizonWeeks).toBe(13);
      expect(result.products.size).toBe(2);
      expect(result.totalProductsProcessed).toBe(2);

      // Each product should have 13 weekly buckets
      const prodA = result.products.get('prod-A');
      expect(prodA?.demandBuckets).toHaveLength(13);
    });

    it('AC-7: output is a Map<produtoId, MpsProductResult>', async () => {
      setupDefaults({
        forecastResults: [
          {
            produtoId: 'prod-A',
            periodo: PLANNING_START,
            p50: mockDecimal(100),
          },
        ],
      });

      const result = await service.generateMps({
        startDate: PLANNING_START,
      });

      expect(result.products).toBeInstanceOf(Map);
      const prodA = result.products.get('prod-A');
      expect(prodA).toBeDefined();
      expect(prodA?.produtoId).toBe('prod-A');
      expect(prodA?.codigo).toBe('SKU-A001');
      expect(prodA?.descricao).toBe('Finished Product A');
    });

    it('test #9: should process multiple products independently', async () => {
      const week1 = PLANNING_START.getTime();

      setupDefaults({
        forecastResults: [
          {
            produtoId: 'prod-A',
            periodo: PLANNING_START,
            p50: mockDecimal(100),
          },
          {
            produtoId: 'prod-B',
            periodo: PLANNING_START,
            p50: mockDecimal(50),
          },
        ],
        firmOrders: [
          {
            produtoId: 'prod-A',
            dataNecessidade: new Date(Date.UTC(2026, 2, 3)),
            quantidade: mockDecimal(200),
          },
          // No firm orders for prod-B
        ],
      });

      const result = await service.generateMps({
        startDate: PLANNING_START,
      });

      const prodA = result.products.get('prod-A');
      const prodB = result.products.get('prod-B');

      // prod-A week 1: MAX(100, 200) = 200 (within default firm horizon=2)
      expect(prodA?.demandBuckets[0].mpsDemand).toBe(200);
      // prod-B week 1: MAX(50, 0) = 50
      expect(prodB?.demandBuckets[0].mpsDemand).toBe(50);
    });

    it('test #10: should generate correct number of weekly buckets', async () => {
      setupDefaults({
        configs: [
          { chave: 'mrp.planning_horizon_weeks', valor: 8 },
        ],
      });

      const result = await service.generateMps({
        startDate: PLANNING_START,
      });

      const prodA = result.products.get('prod-A');
      expect(prodA?.demandBuckets).toHaveLength(8);
      expect(result.planningHorizonWeeks).toBe(8);
    });

    it('should respect planningHorizonWeeks override in input', async () => {
      setupDefaults();

      const result = await service.generateMps({
        startDate: PLANNING_START,
        planningHorizonWeeks: 5,
      });

      const prodA = result.products.get('prod-A');
      expect(prodA?.demandBuckets).toHaveLength(5);
      expect(result.planningHorizonWeeks).toBe(5);
    });

    it('should respect firmOrderHorizonWeeks override in input', async () => {
      setupDefaults({
        forecastResults: [
          {
            produtoId: 'prod-A',
            periodo: PLANNING_START,
            p50: mockDecimal(50),
          },
          {
            produtoId: 'prod-A',
            periodo: new Date(Date.UTC(2026, 2, 9)),
            p50: mockDecimal(50),
          },
          {
            produtoId: 'prod-A',
            periodo: new Date(Date.UTC(2026, 2, 16)),
            p50: mockDecimal(50),
          },
          {
            produtoId: 'prod-A',
            periodo: new Date(Date.UTC(2026, 2, 23)),
            p50: mockDecimal(50),
          },
        ],
        firmOrders: [
          {
            produtoId: 'prod-A',
            dataNecessidade: PLANNING_START,
            quantidade: mockDecimal(200),
          },
          {
            produtoId: 'prod-A',
            dataNecessidade: new Date(Date.UTC(2026, 2, 9)),
            quantidade: mockDecimal(200),
          },
          {
            produtoId: 'prod-A',
            dataNecessidade: new Date(Date.UTC(2026, 2, 16)),
            quantidade: mockDecimal(200),
          },
          {
            produtoId: 'prod-A',
            dataNecessidade: new Date(Date.UTC(2026, 2, 23)),
            quantidade: mockDecimal(200),
          },
        ],
      });

      const result = await service.generateMps({
        startDate: PLANNING_START,
        firmOrderHorizonWeeks: 3,
      });

      const prodA = result.products.get('prod-A');
      // Weeks 0-2 within firm horizon (3 weeks): MAX(50, 200) = 200
      expect(prodA?.demandBuckets[0].mpsDemand).toBe(200);
      expect(prodA?.demandBuckets[1].mpsDemand).toBe(200);
      expect(prodA?.demandBuckets[2].mpsDemand).toBe(200);
      // Week 3 beyond firm horizon: forecast only = 50
      expect(prodA?.demandBuckets[3].mpsDemand).toBe(50);
      expect(result.firmOrderHorizonWeeks).toBe(3);
    });

    it('should calculate totalDemandPlanned correctly (AC-10)', async () => {
      setupDefaults({
        products: [PRODUCTS[0]], // Only prod-A
        forecastResults: [
          {
            produtoId: 'prod-A',
            periodo: PLANNING_START,
            p50: mockDecimal(100),
          },
          {
            produtoId: 'prod-A',
            periodo: new Date(Date.UTC(2026, 2, 9)),
            p50: mockDecimal(200),
          },
        ],
      });

      const result = await service.generateMps({
        startDate: PLANNING_START,
        planningHorizonWeeks: 3,
      });

      // Week 1: 100, Week 2: 200, Week 3: 0 = 300 total
      expect(result.totalDemandPlanned).toBe(300);
      expect(result.totalProductsProcessed).toBe(1);
    });

    it('should handle no finished products gracefully', async () => {
      setupDefaults({
        products: [], // No ACABADO products
      });

      const result = await service.generateMps({
        startDate: PLANNING_START,
      });

      expect(result.products.size).toBe(0);
      expect(result.totalProductsProcessed).toBe(0);
      expect(result.totalDemandPlanned).toBe(0);
    });

    it('should handle no CONCLUIDO forecast execution (AC-11 test #12)', async () => {
      setupDefaults({
        latestExecution: null,
        firmOrders: [
          {
            produtoId: 'prod-A',
            dataNecessidade: PLANNING_START,
            quantidade: mockDecimal(150),
          },
        ],
      });

      const result = await service.generateMps({
        startDate: PLANNING_START,
      });

      const prodA = result.products.get('prod-A');

      // No forecast -> firm orders only within firm horizon
      expect(prodA?.demandBuckets[0].mpsDemand).toBe(150);
      expect(prodA?.warnings.length).toBeGreaterThan(0);
      expect(prodA?.warnings[0]).toContain('No forecast data');
    });

    it('should set generatedAt to approximately now', async () => {
      setupDefaults();

      const before = new Date();
      const result = await service.generateMps({
        startDate: PLANNING_START,
      });
      const after = new Date();

      expect(result.generatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(result.generatedAt.getTime()).toBeLessThanOrEqual(
        after.getTime(),
      );
    });

    it('should use current date aligned to Monday when no startDate provided', async () => {
      setupDefaults();

      const result = await service.generateMps();

      // The start date should be aligned to Monday
      const prodA = result.products.get('prod-A');
      if (prodA && prodA.demandBuckets.length > 0) {
        expect(prodA.demandBuckets[0].periodStart.getUTCDay()).toBe(1); // Monday
      }
    });

    it('should accumulate forecast data falling in the same week', async () => {
      setupDefaults({
        products: [PRODUCTS[0]],
        forecastResults: [
          {
            produtoId: 'prod-A',
            periodo: new Date(Date.UTC(2026, 2, 2)), // Monday
            p50: mockDecimal(60),
          },
          {
            produtoId: 'prod-A',
            periodo: new Date(Date.UTC(2026, 2, 5)), // Thursday (same week)
            p50: mockDecimal(40),
          },
        ],
      });

      const result = await service.generateMps({
        startDate: PLANNING_START,
        planningHorizonWeeks: 2,
      });

      const prodA = result.products.get('prod-A');
      // Both forecasts fall in week 1: 60 + 40 = 100
      expect(prodA?.demandBuckets[0].forecastDemand).toBe(100);
    });

    it('should accumulate firm orders falling in the same week', async () => {
      setupDefaults({
        products: [PRODUCTS[0]],
        firmOrders: [
          {
            produtoId: 'prod-A',
            dataNecessidade: new Date(Date.UTC(2026, 2, 2)), // Monday
            quantidade: mockDecimal(30),
          },
          {
            produtoId: 'prod-A',
            dataNecessidade: new Date(Date.UTC(2026, 2, 6)), // Friday (same week)
            quantidade: mockDecimal(20),
          },
        ],
      });

      const result = await service.generateMps({
        startDate: PLANNING_START,
        planningHorizonWeeks: 2,
      });

      const prodA = result.products.get('prod-A');
      // Both orders fall in week 1: 30 + 20 = 50
      expect(prodA?.demandBuckets[0].firmOrderDemand).toBe(50);
    });

    it('should round demand values to 4 decimal places', async () => {
      setupDefaults({
        products: [PRODUCTS[0]],
        forecastResults: [
          {
            produtoId: 'prod-A',
            periodo: PLANNING_START,
            p50: mockDecimal(100.12345),
          },
        ],
      });

      const result = await service.generateMps({
        startDate: PLANNING_START,
        planningHorizonWeeks: 1,
      });

      const prodA = result.products.get('prod-A');
      const forecastDemand = prodA?.demandBuckets[0].forecastDemand ?? 0;
      const decimalPlaces = forecastDemand.toString().split('.')[1]?.length ?? 0;
      expect(decimalPlaces).toBeLessThanOrEqual(4);
    });

    it('should handle products with forecast but no firm orders (AC-9)', async () => {
      setupDefaults({
        products: [PRODUCTS[0]],
        forecastResults: [
          {
            produtoId: 'prod-A',
            periodo: PLANNING_START,
            p50: mockDecimal(100),
          },
        ],
        firmOrders: [],
      });

      const result = await service.generateMps({
        startDate: PLANNING_START,
        planningHorizonWeeks: 2,
      });

      const prodA = result.products.get('prod-A');
      // Within firm horizon: MAX(100, 0) = 100
      expect(prodA?.demandBuckets[0].mpsDemand).toBe(100);
      expect(prodA?.demandBuckets[0].firmOrderDemand).toBe(0);
      // No warnings for missing firm orders
      expect(prodA?.warnings).toHaveLength(0);
    });

    it('should handle products with firm orders but no forecast (AC-8)', async () => {
      setupDefaults({
        products: [PRODUCTS[0]],
        forecastResults: [], // No forecast for prod-A
        firmOrders: [
          {
            produtoId: 'prod-A',
            dataNecessidade: PLANNING_START,
            quantidade: mockDecimal(150),
          },
        ],
      });

      const result = await service.generateMps({
        startDate: PLANNING_START,
        planningHorizonWeeks: 3,
      });

      const prodA = result.products.get('prod-A');
      // Within firm horizon: MAX(0, 150) = 150
      expect(prodA?.demandBuckets[0].mpsDemand).toBe(150);
      // Beyond firm horizon: forecast only = 0
      expect(prodA?.demandBuckets[2].mpsDemand).toBe(0);
      // Warning logged
      expect(prodA?.warnings.length).toBeGreaterThan(0);
    });

    it('AC-3: firm order horizon from ConfigSistema', async () => {
      setupDefaults({
        configs: [
          { chave: 'mrp.firm_order_horizon_weeks', valor: 4 },
        ],
        products: [PRODUCTS[0]],
        forecastResults: [
          {
            produtoId: 'prod-A',
            periodo: PLANNING_START,
            p50: mockDecimal(50),
          },
          {
            produtoId: 'prod-A',
            periodo: new Date(Date.UTC(2026, 2, 9)),
            p50: mockDecimal(50),
          },
          {
            produtoId: 'prod-A',
            periodo: new Date(Date.UTC(2026, 2, 16)),
            p50: mockDecimal(50),
          },
          {
            produtoId: 'prod-A',
            periodo: new Date(Date.UTC(2026, 2, 23)),
            p50: mockDecimal(50),
          },
          {
            produtoId: 'prod-A',
            periodo: new Date(Date.UTC(2026, 2, 30)),
            p50: mockDecimal(50),
          },
        ],
        firmOrders: [
          {
            produtoId: 'prod-A',
            dataNecessidade: PLANNING_START,
            quantidade: mockDecimal(300),
          },
          {
            produtoId: 'prod-A',
            dataNecessidade: new Date(Date.UTC(2026, 2, 9)),
            quantidade: mockDecimal(300),
          },
          {
            produtoId: 'prod-A',
            dataNecessidade: new Date(Date.UTC(2026, 2, 16)),
            quantidade: mockDecimal(300),
          },
          {
            produtoId: 'prod-A',
            dataNecessidade: new Date(Date.UTC(2026, 2, 23)),
            quantidade: mockDecimal(300),
          },
          {
            produtoId: 'prod-A',
            dataNecessidade: new Date(Date.UTC(2026, 2, 30)),
            quantidade: mockDecimal(300),
          },
        ],
      });

      const result = await service.generateMps({
        startDate: PLANNING_START,
        planningHorizonWeeks: 5,
      });

      expect(result.firmOrderHorizonWeeks).toBe(4);

      const prodA = result.products.get('prod-A');
      // Weeks 0-3 (within 4-week firm horizon): MAX(50, 300) = 300
      expect(prodA?.demandBuckets[0].mpsDemand).toBe(300);
      expect(prodA?.demandBuckets[1].mpsDemand).toBe(300);
      expect(prodA?.demandBuckets[2].mpsDemand).toBe(300);
      expect(prodA?.demandBuckets[3].mpsDemand).toBe(300);
      // Week 4 (beyond firm horizon): forecast only = 50
      expect(prodA?.demandBuckets[4].mpsDemand).toBe(50);
    });

    it('should handle numeric p50 values (not Decimal)', async () => {
      mockPrismaService.configSistema.findMany.mockResolvedValue([]);
      mockPrismaService.produto.findMany.mockResolvedValue([PRODUCTS[0]]);
      mockPrismaService.execucaoPlanejamento.findFirst.mockResolvedValue({
        id: 'exec-001',
      });
      mockPrismaService.forecastResultado.findMany.mockResolvedValue([
        {
          produtoId: 'prod-A',
          periodo: PLANNING_START,
          p50: 75, // plain number, not Decimal
        },
      ]);
      mockPrismaService.ordemPlanejada.findMany.mockResolvedValue([]);

      const result = await service.generateMps({
        startDate: PLANNING_START,
        planningHorizonWeeks: 1,
      });

      const prodA = result.products.get('prod-A');
      expect(prodA?.demandBuckets[0].forecastDemand).toBe(75);
    });

    it('should handle numeric quantidade values (not Decimal)', async () => {
      mockPrismaService.configSistema.findMany.mockResolvedValue([]);
      mockPrismaService.produto.findMany.mockResolvedValue([PRODUCTS[0]]);
      mockPrismaService.execucaoPlanejamento.findFirst.mockResolvedValue({
        id: 'exec-001',
      });
      mockPrismaService.forecastResultado.findMany.mockResolvedValue([]);
      mockPrismaService.ordemPlanejada.findMany.mockResolvedValue([
        {
          produtoId: 'prod-A',
          dataNecessidade: PLANNING_START,
          quantidade: 95, // plain number
        },
      ]);

      const result = await service.generateMps({
        startDate: PLANNING_START,
        planningHorizonWeeks: 1,
      });

      const prodA = result.products.get('prod-A');
      expect(prodA?.demandBuckets[0].firmOrderDemand).toBe(95);
    });
  });
});
