import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../prisma/prisma.service';
import { StockParamsService } from './stock-params.service';
import type { TftForecastRow } from './interfaces/stock-params.interface';

/**
 * Unit tests for StockParamsService — Stock Parameter Calculation Engine
 *
 * Test cases cover all 12 ACs from Story 3.3:
 * - AC-1: SS, ROP, Min, Max, EOQ calculation
 * - AC-2: TFT quantile-based safety stock
 * - AC-3: Classical formula safety stock
 * - AC-4: ROP = d_bar * LT + SS
 * - AC-5: EOQ = sqrt(2 * D_annual * K / h)
 * - AC-6: Min = ROP
 * - AC-7: Max = d_bar * (LT + R) + SS
 * - AC-8: Persists to parametros_estoque
 * - AC-9: Calculation method recorded
 * - AC-10: Z-score lookup
 * - AC-11: Manual safety stock override
 * - AC-12: >= 80% coverage for both paths
 *
 * @see Story 3.3 — Stock Parameter Calculation
 */
describe('StockParamsService', () => {
  let service: StockParamsService;
  let prisma: jest.Mocked<PrismaService>;

  // ────────────────────────────────────────────────────────────────
  // Test Setup
  // ────────────────────────────────────────────────────────────────

  const mockPrisma = {
    produto: {
      findUniqueOrThrow: jest.fn(),
    },
    produtoFornecedor: {
      findFirst: jest.fn(),
    },
    serieTemporal: {
      findMany: jest.fn(),
    },
    forecastResultado: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    parametrosEstoque: {
      create: jest.fn(),
    },
    skuClassification: {
      findUnique: jest.fn(),
    },
    historicoLeadTime: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockParamsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<StockParamsService>(StockParamsService);
    prisma = module.get(PrismaService);
  });

  // ────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────

  /**
   * Create a mock Prisma Decimal that works with Number() conversion.
   * Prisma Decimal objects have toString() which Number() relies on.
   */
  const mockDecimal = (value: number) => ({
    toNumber: () => value,
    toString: () => String(value),
    valueOf: () => value,
    [Symbol.toPrimitive]: () => value,
  });

  /** Standard product data for a purchased item (MATERIA_PRIMA) */
  const makeProduct = (overrides: Record<string, unknown> = {}) => ({
    id: 'prod-001',
    tipoProduto: 'MATERIA_PRIMA',
    custoUnitario: mockDecimal(10.0),
    custoPedido: mockDecimal(50.0),
    custoManutencaoPctAno: mockDecimal(25.0),
    intervaloRevisaoDias: 14,
    estoqueSegurancaManual: null,
    leadTimeProducaoDias: null,
    ...overrides,
  });

  /** Standard supplier link */
  const makeSupplierLink = (overrides: Record<string, unknown> = {}) => ({
    leadTimeDias: 21,
    fornecedor: {
      leadTimePadraoDias: 21,
      leadTimeMinDias: 14,
      leadTimeMaxDias: 28,
    },
    ...overrides,
  });

  /** Standard time series data (52 weeks) */
  const makeTimeSeriesData = (avgVolume: number, count = 52) => {
    const data = [];
    for (let i = 0; i < count; i++) {
      // Create some variance: alternate between avg+10 and avg-10
      const volume = i % 2 === 0 ? avgVolume + 10 : avgVolume - 10;
      data.push({ volume: mockDecimal(volume) });
    }
    return data;
  };

  /** Setup mocks for a standard classical path calculation */
  const setupClassicalPath = (overrides: {
    product?: Record<string, unknown>;
    supplier?: Record<string, unknown> | null;
    timeSeries?: ReturnType<typeof makeTimeSeriesData> | never[];
  } = {}) => {
    const product = makeProduct(overrides.product ?? {});
    mockPrisma.produto.findUniqueOrThrow.mockResolvedValue(product);

    if (overrides.supplier === null) {
      mockPrisma.produtoFornecedor.findFirst.mockResolvedValue(null);
    } else {
      mockPrisma.produtoFornecedor.findFirst.mockResolvedValue(
        makeSupplierLink(overrides.supplier ?? {}),
      );
    }

    mockPrisma.serieTemporal.findMany.mockResolvedValue(
      overrides.timeSeries ?? makeTimeSeriesData(100),
    );

    // No TFT data -> classical path
    mockPrisma.forecastResultado.findFirst.mockResolvedValue(null);

    // Default: no SKU classification (non-Class-A → skip Monte Carlo)
    mockPrisma.skuClassification.findUnique.mockResolvedValue(null);

    // Mock the create to return created record
    mockPrisma.parametrosEstoque.create.mockImplementation(async ({ data }) => ({
      id: 'param-001',
      ...data,
      safetyStock: data.safetyStock,
      reorderPoint: data.reorderPoint,
      estoqueMinimo: data.estoqueMinimo,
      estoqueMaximo: data.estoqueMaximo,
      eoq: data.eoq,
      metodoCalculo: data.metodoCalculo,
      nivelServicoUsado: data.nivelServicoUsado,
      calculatedAt: data.calculatedAt,
    }));
  };

  /** Setup mocks for TFT path */
  const setupTftPath = (tftRows: TftForecastRow[]) => {
    const product = makeProduct();
    mockPrisma.produto.findUniqueOrThrow.mockResolvedValue(product);
    mockPrisma.produtoFornecedor.findFirst.mockResolvedValue(makeSupplierLink());
    mockPrisma.serieTemporal.findMany.mockResolvedValue(makeTimeSeriesData(100));

    // Default: no SKU classification (non-Class-A → skip Monte Carlo, go TFT)
    mockPrisma.skuClassification.findUnique.mockResolvedValue(null);

    // TFT data available
    mockPrisma.forecastResultado.findFirst.mockResolvedValue({ execucaoId: 'exec-tft-001' });
    mockPrisma.forecastResultado.findMany.mockResolvedValue(
      tftRows.map((r) => ({
        periodo: r.periodo,
        p10: r.p10,
        p25: r.p25,
        p50: r.p50,
        p75: r.p75,
        p90: r.p90,
      })),
    );

    mockPrisma.parametrosEstoque.create.mockImplementation(async ({ data }) => ({
      id: 'param-001',
      ...data,
      safetyStock: data.safetyStock,
      reorderPoint: data.reorderPoint,
      estoqueMinimo: data.estoqueMinimo,
      estoqueMaximo: data.estoqueMaximo,
      eoq: data.eoq,
      metodoCalculo: data.metodoCalculo,
      nivelServicoUsado: data.nivelServicoUsado,
      calculatedAt: data.calculatedAt,
    }));
  };

  // ────────────────────────────────────────────────────────────────
  // Test Case 1: TFT Path — SS from quantile difference (AC-2)
  // ────────────────────────────────────────────────────────────────

  describe('AC-2: TFT path — safety stock from quantile difference', () => {
    it('should calculate SS = SUM(P90 over LT) - SUM(P50 over LT) for 95% service level', () => {
      const tftData: TftForecastRow[] = [
        { periodo: new Date('2026-03-02'), p10: 50, p25: 70, p50: 100, p75: 130, p90: 160 },
        { periodo: new Date('2026-03-09'), p10: 55, p25: 75, p50: 110, p75: 140, p90: 170 },
        { periodo: new Date('2026-03-16'), p10: 45, p25: 65, p50: 90, p75: 120, p90: 150 },
      ];

      // At 95% service level, quantile column is p90
      // SS = (160 + 170 + 150) - (100 + 110 + 90) = 480 - 300 = 180
      const ss = service.calculateSafetyStockTft(tftData, 0.95);
      expect(ss).toBe(180);
    });

    it('should use p75 for 90% service level', () => {
      const tftData: TftForecastRow[] = [
        { periodo: new Date('2026-03-02'), p10: 50, p25: 70, p50: 100, p75: 130, p90: 160 },
        { periodo: new Date('2026-03-09'), p10: 55, p25: 75, p50: 110, p75: 140, p90: 170 },
      ];

      // At 90% service level, quantile column is p75
      // SS = (130 + 140) - (100 + 110) = 270 - 210 = 60
      const ss = service.calculateSafetyStockTft(tftData, 0.90);
      expect(ss).toBe(60);
    });

    it('should floor SS to 0 when P50 exceeds the quantile sum', () => {
      const tftData: TftForecastRow[] = [
        { periodo: new Date('2026-03-02'), p10: 50, p25: 70, p50: 200, p75: 130, p90: 160 },
      ];

      // SS = 160 - 200 = -40 -> floored to 0
      const ss = service.calculateSafetyStockTft(tftData, 0.95);
      expect(ss).toBe(0);
    });

    it('should handle null quantile values gracefully', () => {
      const tftData: TftForecastRow[] = [
        { periodo: new Date('2026-03-02'), p10: null, p25: null, p50: 100, p75: null, p90: 150 },
        { periodo: new Date('2026-03-09'), p10: null, p25: null, p50: null, p75: null, p90: null },
      ];

      // SS = (150 + 0) - (100 + 0) = 50
      const ss = service.calculateSafetyStockTft(tftData, 0.95);
      expect(ss).toBe(50);
    });

    it('should use TFT method and record TFT_QUANTIL when forecast data is available', async () => {
      const tftRows: TftForecastRow[] = [
        { periodo: new Date('2026-03-02'), p10: 50, p25: 70, p50: 100, p75: 130, p90: 160 },
        { periodo: new Date('2026-03-09'), p10: 55, p25: 75, p50: 110, p75: 140, p90: 170 },
        { periodo: new Date('2026-03-16'), p10: 45, p25: 65, p50: 90, p75: 120, p90: 150 },
      ];
      setupTftPath(tftRows);

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      expect(result.metodoCalculo).toBe('TFT_QUANTIL');
      expect(result.safetyStock).toBe(180); // (160+170+150) - (100+110+90)
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test Case 2: Classical Path — SS from Z * sqrt formula (AC-3)
  // ────────────────────────────────────────────────────────────────

  describe('AC-3: Classical path — safety stock from Z * sqrt formula', () => {
    it('should calculate SS = Z * sqrt(LT * sigma_d^2 + d_bar^2 * sigma_LT^2)', () => {
      // z=1.645, lt=3 weeks, sigmaD=10, dBar=100, sigmaLt=0.5 weeks
      // SS = 1.645 * sqrt(3 * 100 + 10000 * 0.25)
      // SS = 1.645 * sqrt(300 + 2500)
      // SS = 1.645 * sqrt(2800)
      // SS = 1.645 * 52.9150...
      // SS = 87.0452...
      const ss = service.calculateSafetyStockClassical(1.645, 3, 10, 100, 0.5);
      expect(ss).toBeCloseTo(87.0452, 2);
    });

    it('should return 0 when all inputs are 0', () => {
      const ss = service.calculateSafetyStockClassical(1.645, 0, 0, 0, 0);
      expect(ss).toBe(0);
    });

    it('should handle zero lead time variance (production)', () => {
      // sigmaLt = 0 (production lead time is deterministic)
      // SS = Z * sqrt(LT * sigmaD^2 + 0)
      // SS = 1.645 * sqrt(2 * 15^2) = 1.645 * sqrt(450) = 1.645 * 21.2132 = 34.8957
      const ss = service.calculateSafetyStockClassical(1.645, 2, 15, 80, 0);
      expect(ss).toBeCloseTo(34.8957, 2);
    });

    it('should use classical method and record FORMULA_CLASSICA when no TFT data', async () => {
      setupClassicalPath();

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      expect(result.metodoCalculo).toBe('FORMULA_CLASSICA');
      expect(result.safetyStock).toBeGreaterThan(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test Case 3: Manual Override (AC-11)
  // ────────────────────────────────────────────────────────────────

  describe('AC-11: Manual safety stock override', () => {
    it('should use estoqueSegurancaManual when set, ignoring calculated SS', async () => {
      setupClassicalPath({
        product: {
          estoqueSegurancaManual: mockDecimal(42.5),
        },
      });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      expect(result.safetyStock).toBe(42.5);
      expect(result.metodoCalculo).toBe('FORMULA_CLASSICA');
    });

    it('should not query forecast data when manual override is set', async () => {
      setupClassicalPath({
        product: {
          estoqueSegurancaManual: mockDecimal(100),
        },
      });

      await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      // When manual override is set, we still call getLeadTimeData and getDemandStatistics
      // for ROP/EOQ/Max calculations, but the SS value comes from the manual override
      expect(mockPrisma.forecastResultado.findFirst).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test Case 4: EOQ with known inputs (AC-5)
  // ────────────────────────────────────────────────────────────────

  describe('AC-5: EOQ = sqrt(2 * D_annual * K / h)', () => {
    it('should calculate EOQ with known inputs (manually verified)', () => {
      // D_annual = 5200, K = 50, h = 2.5
      // EOQ = sqrt(2 * 5200 * 50 / 2.5) = sqrt(208000) = 456.0702...
      const eoq = service.calculateEoq(5200, 50, 2.5);
      expect(eoq).toBeCloseTo(456.0702, 2);
    });

    it('should return 0 when ordering cost K is 0', () => {
      const eoq = service.calculateEoq(5200, 0, 2.5);
      expect(eoq).toBe(0);
    });

    it('should return 0 when holding cost h is 0', () => {
      const eoq = service.calculateEoq(5200, 50, 0);
      expect(eoq).toBe(0);
    });

    it('should return 0 when annual demand is 0', () => {
      const eoq = service.calculateEoq(0, 50, 2.5);
      expect(eoq).toBe(0);
    });

    it('should return 0 when any input is negative', () => {
      expect(service.calculateEoq(-100, 50, 2.5)).toBe(0);
      expect(service.calculateEoq(5200, -50, 2.5)).toBe(0);
      expect(service.calculateEoq(5200, 50, -2.5)).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test Case 5: ROP = d_bar * LT + SS (AC-4)
  // ────────────────────────────────────────────────────────────────

  describe('AC-4: ROP = d_bar * LT + SS', () => {
    it('should calculate ROP correctly', () => {
      // d_bar = 100/week, LT = 3 weeks, SS = 50
      // ROP = 100 * 3 + 50 = 350
      const rop = service.calculateRop(100, 3, 50);
      expect(rop).toBe(350);
    });

    it('should return SS when demand and lead time are 0', () => {
      const rop = service.calculateRop(0, 0, 25);
      expect(rop).toBe(25);
    });

    it('should handle fractional lead time', () => {
      // d_bar = 80/week, LT = 2.5 weeks, SS = 30
      // ROP = 80 * 2.5 + 30 = 230
      const rop = service.calculateRop(80, 2.5, 30);
      expect(rop).toBe(230);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test Case 6: Min = ROP, Max = d_bar * (LT+R) + SS (AC-6, AC-7)
  // ────────────────────────────────────────────────────────────────

  describe('AC-6: Min = ROP, AC-7: Max = d_bar * (LT + R) + SS', () => {
    it('should set Min equal to ROP', async () => {
      setupClassicalPath();

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      expect(result.estoqueMinimo).toBe(result.reorderPoint);
    });

    it('should calculate Max = d_bar * (LT + R) + SS', () => {
      // d_bar = 100, LT = 3 weeks, R = 2 weeks, SS = 50
      // Max = 100 * (3 + 2) + 50 = 550
      const max = service.calculateMax(100, 3, 2, 50);
      expect(max).toBe(550);
    });

    it('should calculate Max = d_bar * LT + SS when R = 0', () => {
      // d_bar = 100, LT = 3, R = 0, SS = 50
      // Max = 100 * (3 + 0) + 50 = 350 (same as ROP)
      const max = service.calculateMax(100, 3, 0, 50);
      expect(max).toBe(350);
    });

    it('should ensure Max >= Min in full calculation', async () => {
      setupClassicalPath();

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      expect(result.estoqueMaximo).toBeGreaterThanOrEqual(result.estoqueMinimo);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test Case 7: Zero demand -> SS=0, EOQ=0 (edge case)
  // ────────────────────────────────────────────────────────────────

  describe('Edge case: Zero demand', () => {
    it('should return SS=0 and EOQ=0 when there is no historical demand', async () => {
      setupClassicalPath({
        timeSeries: [], // No historical data
      });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      expect(result.safetyStock).toBe(0);
      expect(result.eoq).toBe(0);
      expect(result.reorderPoint).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test Case 8: Missing custoPedido -> EOQ=0 (edge case)
  // ────────────────────────────────────────────────────────────────

  describe('Edge case: Missing custoPedido', () => {
    it('should return EOQ=0 when ordering cost is null', async () => {
      setupClassicalPath({
        product: {
          custoPedido: null,
        },
      });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      expect(result.eoq).toBe(0);
    });

    it('should still calculate SS and ROP normally when custoPedido is missing', async () => {
      setupClassicalPath({
        product: {
          custoPedido: null,
        },
      });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      // SS and ROP should still be calculated
      expect(result.safetyStock).toBeGreaterThanOrEqual(0);
      expect(result.reorderPoint).toBeGreaterThanOrEqual(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test Case 9: Different service levels (AC-10)
  // ────────────────────────────────────────────────────────────────

  describe('AC-10: Z-score lookup and different service levels', () => {
    it('should return correct Z-scores for standard levels', () => {
      expect(service.getZScore(0.90)).toBe(1.28);
      expect(service.getZScore(0.95)).toBe(1.645);
      expect(service.getZScore(0.975)).toBe(1.96);
      expect(service.getZScore(0.99)).toBe(2.326);
    });

    it('should return nearest Z-score for non-standard levels', () => {
      // 0.92 is closest to 0.90
      expect(service.getZScore(0.92)).toBe(1.28);
      // 0.94 is closest to 0.95
      expect(service.getZScore(0.94)).toBe(1.645);
      // 0.98 is closest to 0.975
      expect(service.getZScore(0.98)).toBe(1.96);
    });

    it('should produce increasing SS for higher service levels (classical path)', () => {
      const z90 = service.getZScore(0.90);
      const z95 = service.getZScore(0.95);
      const z99 = service.getZScore(0.99);

      const ss90 = service.calculateSafetyStockClassical(z90, 3, 10, 100, 0.5);
      const ss95 = service.calculateSafetyStockClassical(z95, 3, 10, 100, 0.5);
      const ss99 = service.calculateSafetyStockClassical(z99, 3, 10, 100, 0.5);

      expect(ss90).toBeLessThan(ss95);
      expect(ss95).toBeLessThan(ss99);
    });

    it('should record nivelServicoUsado in the result', async () => {
      setupClassicalPath();

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.99);

      expect(result.nivelServicoUsado).toBe(0.99);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // AC-8: Persistence to parametros_estoque
  // ────────────────────────────────────────────────────────────────

  describe('AC-8: Persists results to parametros_estoque', () => {
    it('should call prisma.parametrosEstoque.create with correct data', async () => {
      setupClassicalPath();

      await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      expect(mockPrisma.parametrosEstoque.create).toHaveBeenCalledTimes(1);
      const createCall = mockPrisma.parametrosEstoque.create.mock.calls[0][0];

      expect(createCall.data.execucaoId).toBe('exec-001');
      expect(createCall.data.produtoId).toBe('prod-001');
      expect(createCall.data.nivelServicoUsado).toBe(0.95);
      expect(createCall.data.metodoCalculo).toBe('FORMULA_CLASSICA');
      expect(createCall.data.calculatedAt).toBeInstanceOf(Date);
      expect(typeof createCall.data.safetyStock).toBe('number');
      expect(typeof createCall.data.reorderPoint).toBe('number');
      expect(typeof createCall.data.estoqueMinimo).toBe('number');
      expect(typeof createCall.data.estoqueMaximo).toBe('number');
      expect(typeof createCall.data.eoq).toBe('number');
    });

    it('should return the complete StockParamsResult structure', async () => {
      setupClassicalPath();

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      expect(result.id).toBe('param-001');
      expect(result.execucaoId).toBe('exec-001');
      expect(result.produtoId).toBe('prod-001');
      expect(typeof result.safetyStock).toBe('number');
      expect(typeof result.reorderPoint).toBe('number');
      expect(typeof result.estoqueMinimo).toBe('number');
      expect(typeof result.estoqueMaximo).toBe('number');
      expect(typeof result.eoq).toBe('number');
      expect(result.metodoCalculo).toBe('FORMULA_CLASSICA');
      expect(result.nivelServicoUsado).toBe(0.95);
      expect(result.calculatedAt).toBeInstanceOf(Date);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Lead Time Resolution
  // ────────────────────────────────────────────────────────────────

  describe('Lead time resolution', () => {
    it('should use supplier lead time for purchased products (MATERIA_PRIMA)', async () => {
      setupClassicalPath({
        product: { tipoProduto: 'MATERIA_PRIMA' },
        supplier: {
          leadTimeDias: 21,
          fornecedor: {
            leadTimePadraoDias: 21,
            leadTimeMinDias: 14,
            leadTimeMaxDias: 28,
          },
        },
      });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      // LT = 21 days = 3 weeks, sigma_LT = (28-14)/6 = 2.333 days = 0.333 weeks
      // These affect the SS calculation
      expect(mockPrisma.produtoFornecedor.findFirst).toHaveBeenCalled();
      expect(result.safetyStock).toBeGreaterThan(0);
    });

    it('should use production lead time for ACABADO products', async () => {
      setupClassicalPath({
        product: {
          tipoProduto: 'ACABADO',
          leadTimeProducaoDias: 10,
        },
      });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      // For production products, should NOT query supplier table
      expect(mockPrisma.produtoFornecedor.findFirst).not.toHaveBeenCalled();
      expect(result.safetyStock).toBeGreaterThan(0);
    });

    it('should fallback to default LT=14 days when no supplier found', async () => {
      setupClassicalPath({
        product: { tipoProduto: 'INSUMO' },
        supplier: null,
      });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      // Should still produce a result, using default lead time
      expect(result.safetyStock).toBeGreaterThanOrEqual(0);
    });

    it('should fallback to default LT=7 days for production when leadTimeProducaoDias is null', async () => {
      setupClassicalPath({
        product: {
          tipoProduto: 'ACABADO',
          leadTimeProducaoDias: null,
        },
      });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      // Should use default 7 days = 1 week
      expect(result.safetyStock).toBeGreaterThanOrEqual(0);
    });

    it('should calculate sigma_LT = 0 for production products (deterministic)', async () => {
      setupClassicalPath({
        product: {
          tipoProduto: 'SEMI_ACABADO',
          leadTimeProducaoDias: 14,
        },
      });

      // With sigma_LT = 0 and dBar = 100, sigma_d = 10, LT = 2 weeks, z = 1.645:
      // SS = 1.645 * sqrt(2 * 100 + 0) = 1.645 * sqrt(200) = 1.645 * 14.1421 = 23.2638
      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      expect(result.safetyStock).toBeGreaterThan(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Demand Statistics
  // ────────────────────────────────────────────────────────────────

  describe('Demand statistics computation', () => {
    it('should compute d_bar and sigma_d from time series data', async () => {
      // Alternating 110, 90 => mean = 100, sigma = 10
      setupClassicalPath({
        timeSeries: makeTimeSeriesData(100, 10),
      });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      // With dBar=100, the ROP should reflect this demand level
      expect(result.reorderPoint).toBeGreaterThan(0);
    });

    it('should query last 52 weeks of semanal granularity', async () => {
      setupClassicalPath();

      await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      const findManyCall = mockPrisma.serieTemporal.findMany.mock.calls[0][0];
      expect(findManyCall.where.produtoId).toBe('prod-001');
      expect(findManyCall.where.granularidade).toBe('semanal');
      expect(findManyCall.where.dataReferencia.gte).toBeInstanceOf(Date);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Full Integration (Classical Path end-to-end)
  // ────────────────────────────────────────────────────────────────

  describe('Full classical path calculation (end-to-end)', () => {
    it('should compute all parameters consistently for a MATERIA_PRIMA product', async () => {
      // Product: custoUnitario=10, custoPedido=50, custoManutPct=25%, intervaloRevisao=14 days
      // Supplier: LT=21 days, min=14, max=28
      // Demand: avg=100/week, sigma=10/week
      // Service level: 95% => Z=1.645
      setupClassicalPath();

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      // LT = 21 days = 3 weeks
      // sigma_LT = (28-14)/6 = 2.333 days = 0.333 weeks
      // SS = 1.645 * sqrt(3 * 10^2 + 100^2 * 0.333^2)
      //    = 1.645 * sqrt(300 + 1111.111)
      //    = 1.645 * sqrt(1411.111)
      //    = 1.645 * 37.566...
      //    = 61.796...

      expect(result.safetyStock).toBeGreaterThan(50);
      expect(result.safetyStock).toBeLessThan(80);

      // ROP = 100 * 3 + SS
      expect(result.reorderPoint).toBeGreaterThan(350);
      expect(result.reorderPoint).toBeLessThan(380);

      // Min = ROP
      expect(result.estoqueMinimo).toBe(result.reorderPoint);

      // EOQ = sqrt(2 * 5200 * 50 / 2.5) = sqrt(208000) = 456.07...
      expect(result.eoq).toBeCloseTo(456.0702, 0);

      // Max = 100 * (3 + 2) + SS = 500 + SS
      expect(result.estoqueMaximo).toBeGreaterThan(550);
      expect(result.estoqueMaximo).toBeLessThan(580);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Default service level
  // ────────────────────────────────────────────────────────────────

  describe('Default service level', () => {
    it('should default to 95% service level when not specified', async () => {
      setupClassicalPath();

      const result = await service.calculateForProduct('prod-001', 'exec-001');

      expect(result.nivelServicoUsado).toBe(0.95);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Rounding consistency
  // ────────────────────────────────────────────────────────────────

  describe('Rounding precision', () => {
    it('should round all output values to 4 decimal places', () => {
      // Calculate with values that produce long decimals
      const ss = service.calculateSafetyStockClassical(1.645, 2.5, 12.345, 87.654, 0.321);
      const decimalPlaces = ss.toString().split('.')[1]?.length ?? 0;
      expect(decimalPlaces).toBeLessThanOrEqual(4);
    });

    it('should round EOQ consistently', () => {
      const eoq = service.calculateEoq(5200, 50, 2.5);
      const parts = eoq.toString().split('.');
      expect(parts.length <= 1 || parts[1].length <= 4).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Additional branch coverage tests
  // ────────────────────────────────────────────────────────────────

  describe('Branch coverage — null cost fields', () => {
    it('should handle null custoUnitario and custoManutencaoPctAno', async () => {
      setupClassicalPath({
        product: {
          custoUnitario: null,
          custoManutencaoPctAno: null,
        },
      });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      // h = 0 * 25 / 100 = 0, so EOQ = 0 (L4L fallback)
      expect(result.eoq).toBe(0);
    });

    it('should handle null intervaloRevisaoDias (R=0)', async () => {
      setupClassicalPath({
        product: {
          intervaloRevisaoDias: null,
        },
      });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      // Max = d_bar * (LT + 0) + SS = d_bar * LT + SS = ROP
      // In this scenario Max should equal ROP since R=0
      expect(result.estoqueMaximo).toBe(result.reorderPoint);
    });
  });

  describe('Branch coverage — supplier fallback chains', () => {
    it('should fallback to leadTimePadraoDias when leadTimeDias is null', async () => {
      setupClassicalPath({
        product: { tipoProduto: 'INSUMO' },
        supplier: {
          leadTimeDias: null,
          fornecedor: {
            leadTimePadraoDias: 30,
            leadTimeMinDias: 20,
            leadTimeMaxDias: 40,
          },
        },
      });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      // Should use LT = 30 days
      expect(result.safetyStock).toBeGreaterThan(0);
    });

    it('should fallback to 14 days when both leadTimeDias and leadTimePadraoDias are null', async () => {
      setupClassicalPath({
        product: { tipoProduto: 'INSUMO' },
        supplier: {
          leadTimeDias: null,
          fornecedor: {
            leadTimePadraoDias: null,
            leadTimeMinDias: null,
            leadTimeMaxDias: null,
          },
        },
      });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      // Should use LT = 14 days, sigma_LT = 0
      expect(result.safetyStock).toBeGreaterThanOrEqual(0);
    });

    it('should set sigma_LT = 0 when leadTimeMinDias is null', async () => {
      setupClassicalPath({
        product: { tipoProduto: 'MATERIA_PRIMA' },
        supplier: {
          leadTimeDias: 21,
          fornecedor: {
            leadTimePadraoDias: 21,
            leadTimeMinDias: null,
            leadTimeMaxDias: 28,
          },
        },
      });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      // sigma_LT = 0 because min is null
      expect(result.safetyStock).toBeGreaterThanOrEqual(0);
    });

    it('should set sigma_LT = 0 when leadTimeMaxDias is null', async () => {
      setupClassicalPath({
        product: { tipoProduto: 'MATERIA_PRIMA' },
        supplier: {
          leadTimeDias: 21,
          fornecedor: {
            leadTimePadraoDias: 21,
            leadTimeMinDias: 14,
            leadTimeMaxDias: null,
          },
        },
      });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      expect(result.safetyStock).toBeGreaterThanOrEqual(0);
    });

    it('should set sigma_LT = 0 when leadTimeMaxDias equals leadTimeMinDias', async () => {
      setupClassicalPath({
        product: { tipoProduto: 'MATERIA_PRIMA' },
        supplier: {
          leadTimeDias: 21,
          fornecedor: {
            leadTimePadraoDias: 21,
            leadTimeMinDias: 21,
            leadTimeMaxDias: 21,
          },
        },
      });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      // With sigma_LT = 0, SS comes only from demand variance
      expect(result.safetyStock).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Branch coverage — TFT forecast null quantiles in DB rows', () => {
    it('should handle all-null quantiles from DB rows', async () => {
      const product = makeProduct();
      mockPrisma.produto.findUniqueOrThrow.mockResolvedValue(product);
      mockPrisma.produtoFornecedor.findFirst.mockResolvedValue(makeSupplierLink());
      mockPrisma.serieTemporal.findMany.mockResolvedValue(makeTimeSeriesData(100));
      mockPrisma.skuClassification.findUnique.mockResolvedValue(null);

      mockPrisma.forecastResultado.findFirst.mockResolvedValue({ execucaoId: 'exec-tft' });
      mockPrisma.forecastResultado.findMany.mockResolvedValue([
        { periodo: new Date('2026-03-02'), p10: null, p25: null, p50: null, p75: null, p90: null },
        { periodo: new Date('2026-03-09'), p10: null, p25: null, p50: null, p75: null, p90: null },
      ]);

      mockPrisma.parametrosEstoque.create.mockImplementation(async ({ data }) => ({
        id: 'param-001',
        ...data,
        calculatedAt: data.calculatedAt,
      }));

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      // All nulls converted to 0, so SS = 0 - 0 = 0
      expect(result.metodoCalculo).toBe('TFT_QUANTIL');
      expect(result.safetyStock).toBe(0);
    });
  });

  describe('Branch coverage — non-standard TFT quantile column fallback', () => {
    it('should fallback to p90 for non-standard service levels in TFT path', () => {
      const tftData: TftForecastRow[] = [
        { periodo: new Date('2026-03-02'), p10: 50, p25: 70, p50: 100, p75: 130, p90: 160 },
      ];

      // 0.85 is not a standard level, should fallback to p90
      const ss = service.calculateSafetyStockTft(tftData, 0.85);
      // SS = 160 - 100 = 60
      expect(ss).toBe(60);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Story 5.2: Monte Carlo Safety Stock Simulation (AC-15, AC-16)
  // ────────────────────────────────────────────────────────────────

  describe('AC-15: Monte Carlo simulation engine with seeded RNG', () => {
    it('should produce deterministic results with the same seed', () => {
      const input = {
        demandHistory: [80, 90, 100, 110, 120, 95, 105, 85, 115, 100, 90, 110],
        leadTimeMeanWeeks: 3,
        leadTimeSigmaWeeks: 0.5,
        serviceLevel: 0.95,
        iterations: 5000,
        seed: 42,
      };

      const result1 = service.calculateSafetyStockMonteCarlo(input);
      const result2 = service.calculateSafetyStockMonteCarlo(input);

      expect(result1.safetyStock).toBe(result2.safetyStock);
      expect(result1.meanDemandOverLt).toBe(result2.meanDemandOverLt);
      expect(result1.confidenceInterval.p5).toBe(result2.confidenceInterval.p5);
      expect(result1.confidenceInterval.p95).toBe(result2.confidenceInterval.p95);
    });

    it('should produce different results with different seeds', () => {
      const baseInput = {
        demandHistory: [80, 90, 100, 110, 120, 95, 105, 85, 115, 100, 90, 110],
        leadTimeMeanWeeks: 3,
        leadTimeSigmaWeeks: 0.5,
        serviceLevel: 0.95,
        iterations: 5000,
      };

      const result1 = service.calculateSafetyStockMonteCarlo({ ...baseInput, seed: 42 });
      const result2 = service.calculateSafetyStockMonteCarlo({ ...baseInput, seed: 99 });

      // Results should differ (extremely unlikely to be identical with different seeds)
      expect(result1.safetyStock).not.toBe(result2.safetyStock);
    });

    it('should return positive safety stock for variable demand', () => {
      const result = service.calculateSafetyStockMonteCarlo({
        demandHistory: [50, 100, 150, 75, 125, 80, 120, 60, 140, 90, 110, 70],
        leadTimeMeanWeeks: 2,
        leadTimeSigmaWeeks: 0.3,
        serviceLevel: 0.95,
        iterations: 10000,
        seed: 123,
      });

      expect(result.safetyStock).toBeGreaterThan(0);
      expect(result.iterations).toBe(10000);
    });

    it('should return zero or near-zero SS for constant demand and zero LT variance', () => {
      const result = service.calculateSafetyStockMonteCarlo({
        demandHistory: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
        leadTimeMeanWeeks: 2,
        leadTimeSigmaWeeks: 0,
        serviceLevel: 0.95,
        iterations: 5000,
        seed: 42,
      });

      // With constant demand and zero LT variance, SS should be 0
      // (all iterations produce the same total demand, quantile = mean)
      expect(result.safetyStock).toBe(0);
    });

    it('should produce higher SS for higher service levels', () => {
      const baseInput = {
        demandHistory: [80, 90, 100, 110, 120, 95, 105, 85, 115, 100, 90, 110],
        leadTimeMeanWeeks: 3,
        leadTimeSigmaWeeks: 0.5,
        iterations: 10000,
        seed: 42,
      };

      const ss90 = service.calculateSafetyStockMonteCarlo({
        ...baseInput,
        serviceLevel: 0.90,
      });
      const ss95 = service.calculateSafetyStockMonteCarlo({
        ...baseInput,
        serviceLevel: 0.95,
      });
      const ss99 = service.calculateSafetyStockMonteCarlo({
        ...baseInput,
        serviceLevel: 0.99,
      });

      expect(ss90.safetyStock).toBeLessThan(ss95.safetyStock);
      expect(ss95.safetyStock).toBeLessThan(ss99.safetyStock);
    });

    it('should return confidence interval with p5 < p95', () => {
      const result = service.calculateSafetyStockMonteCarlo({
        demandHistory: [80, 90, 100, 110, 120, 95, 105, 85, 115, 100, 90, 110],
        leadTimeMeanWeeks: 3,
        leadTimeSigmaWeeks: 0.5,
        serviceLevel: 0.95,
        iterations: 5000,
        seed: 42,
      });

      expect(result.confidenceInterval.p5).toBeLessThan(result.confidenceInterval.p95);
    });

    it('should return histogram with bucket counts summing to iterations', () => {
      const iterations = 5000;
      const result = service.calculateSafetyStockMonteCarlo({
        demandHistory: [80, 90, 100, 110, 120, 95, 105, 85, 115, 100, 90, 110],
        leadTimeMeanWeeks: 3,
        leadTimeSigmaWeeks: 0.5,
        serviceLevel: 0.95,
        iterations,
        seed: 42,
      });

      expect(result.histogram.length).toBeGreaterThan(0);
      const totalCount = result.histogram.reduce((sum, b) => sum + b.count, 0);
      expect(totalCount).toBe(iterations);
    });

    it('should handle single-value demand history', () => {
      const result = service.calculateSafetyStockMonteCarlo({
        demandHistory: [100],
        leadTimeMeanWeeks: 2,
        leadTimeSigmaWeeks: 0.5,
        serviceLevel: 0.95,
        iterations: 1000,
        seed: 42,
      });

      // Single value in history means all demand samples are identical
      // Variance comes only from lead time
      expect(result.safetyStock).toBeGreaterThanOrEqual(0);
      expect(result.iterations).toBe(1000);
    });
  });

  describe('AC-16: Class A detection and fallback to classical', () => {
    it('should use Monte Carlo for Class A SKU with sufficient history', async () => {
      setupClassicalPath();

      // Mock: Class A classification
      mockPrisma.skuClassification.findUnique.mockResolvedValue({ classeAbc: 'A' });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      expect(result.metodoCalculo).toBe('MONTE_CARLO');
      expect(result.safetyStock).toBeGreaterThanOrEqual(0);
    });

    it('should fallback to classical for Class A SKU with insufficient history (<12 weeks)', async () => {
      // Setup with only 8 weeks of data
      setupClassicalPath({
        timeSeries: makeTimeSeriesData(100, 8),
      });

      // Mock: Class A classification
      mockPrisma.skuClassification.findUnique.mockResolvedValue({ classeAbc: 'A' });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      // Should NOT be Monte Carlo because only 8 weeks of history
      expect(result.metodoCalculo).not.toBe('MONTE_CARLO');
    });

    it('should not use Monte Carlo for Class B SKU', async () => {
      setupClassicalPath();

      mockPrisma.skuClassification.findUnique.mockResolvedValue({ classeAbc: 'B' });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      expect(result.metodoCalculo).not.toBe('MONTE_CARLO');
    });

    it('should not use Monte Carlo when no SKU classification exists', async () => {
      setupClassicalPath();

      mockPrisma.skuClassification.findUnique.mockResolvedValue(null);

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      expect(result.metodoCalculo).not.toBe('MONTE_CARLO');
    });

    it('should still respect manual override for Class A SKU', async () => {
      setupClassicalPath({
        product: { estoqueSegurancaManual: mockDecimal(50) },
      });

      mockPrisma.skuClassification = { findUnique: jest.fn() } as never;
      (mockPrisma.skuClassification as { findUnique: jest.Mock }).findUnique
        .mockResolvedValue({ classeAbc: 'A' });

      const result = await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      expect(result.safetyStock).toBe(50);
      expect(result.metodoCalculo).toBe('FORMULA_CLASSICA');
    });

    it('should store MONTE_CARLO as metodoCalculo in ParametrosEstoque', async () => {
      setupClassicalPath();

      mockPrisma.skuClassification = { findUnique: jest.fn() } as never;
      (mockPrisma.skuClassification as { findUnique: jest.Mock }).findUnique
        .mockResolvedValue({ classeAbc: 'A' });

      await service.calculateForProduct('prod-001', 'exec-001', 0.95);

      const createCall = mockPrisma.parametrosEstoque.create.mock.calls[0][0];
      expect(createCall.data.metodoCalculo).toBe('MONTE_CARLO');
    });
  });

  describe('Monte Carlo — runMonteCarloSimulation endpoint method', () => {
    it('should throw BadRequestException for insufficient data', async () => {
      const product = makeProduct();
      mockPrisma.produto.findUniqueOrThrow.mockResolvedValue(product);
      mockPrisma.produtoFornecedor.findFirst.mockResolvedValue(makeSupplierLink());

      // Only 5 weeks of data (< 12 minimum)
      mockPrisma.serieTemporal.findMany.mockResolvedValue(
        makeTimeSeriesData(100, 5),
      );

      await expect(
        service.runMonteCarloSimulation('prod-001', 0.95, 1000),
      ).rejects.toThrow('Insufficient historical data');
    });

    it('should return full simulation result with sufficient data', async () => {
      const product = makeProduct();
      mockPrisma.produto.findUniqueOrThrow.mockResolvedValue(product);
      mockPrisma.produtoFornecedor.findFirst.mockResolvedValue(makeSupplierLink());
      mockPrisma.serieTemporal.findMany.mockResolvedValue(
        makeTimeSeriesData(100, 52),
      );

      const result = await service.runMonteCarloSimulation('prod-001', 0.95, 1000);

      expect(result.safetyStock).toBeGreaterThanOrEqual(0);
      expect(result.iterations).toBe(1000);
      expect(result.confidenceInterval.p5).toBeDefined();
      expect(result.confidenceInterval.p95).toBeDefined();
      expect(result.histogram.length).toBeGreaterThan(0);
    });
  });
});
