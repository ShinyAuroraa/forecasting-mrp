import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../prisma/prisma.service';
import { OrderGenerationService } from './order-generation.service';
import type {
  OrderGenerationInput,
  PlannedOrderInput,
} from './interfaces/order-generation.interface';

/**
 * Unit tests for OrderGenerationService — Planned Order Generation Engine
 *
 * Test cases cover all 12 ACs from Story 3.7:
 *   1.  COMPRA order with isPrincipal supplier (AC-2, AC-4)
 *   2.  COMPRA order fallback to lowest precoUnitario (AC-4)
 *   3.  No supplier found → warning, fornecedorId = null (AC-4)
 *   4.  COMPRA cost = qty * precoUnitario (AC-5)
 *   5.  PRODUCAO order with routing and work center (AC-3, AC-6)
 *   6.  PRODUCAO cost = (setup + qty * unitTime) / 60 * custoHora (AC-7)
 *   7.  PRODUCAO centroTrabalhoId from first routing step (AC-6)
 *   8.  Release date offset by lead time (AC-8)
 *   9.  Priority CRITICA — past due (AC-9)
 *   10. Priority ALTA — within 7 days (AC-9)
 *   11. Priority MEDIA / BAIXA (AC-9)
 *   12. Multiple orders across periods (AC-1)
 *   13. Persistence: createMany called with correct data (AC-11)
 *   14. execucaoId linked to all orders (AC-10)
 *   15. Unknown tipoProduto generates warning
 *   16. PRODUCAO with no routing steps → warning
 *   17. COMPRA with no precoUnitario → warning, cost null
 *
 * @see Story 3.7 — Planned Order Generation
 * @see FR-038 — Order Generation
 */
describe('OrderGenerationService', () => {
  let service: OrderGenerationService;

  // ────────────────────────────────────────────────────────────────
  // Mock Setup
  // ────────────────────────────────────────────────────────────────

  const mockPrismaService = {
    produtoFornecedor: {
      findFirst: jest.fn(),
    },
    roteiroProducao: {
      findMany: jest.fn(),
    },
    produto: {
      findUnique: jest.fn(),
    },
    ordemPlanejada: {
      createMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderGenerationService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<OrderGenerationService>(OrderGenerationService);

    // Default: createMany resolves successfully
    mockPrismaService.ordemPlanejada.createMany.mockResolvedValue({ count: 0 });

    // Default: no product lead time
    mockPrismaService.produto.findUnique.mockResolvedValue(null);
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

  /** Fixed reference date: 2026-03-02 UTC (Monday) */
  const REFERENCE_DATE = new Date(Date.UTC(2026, 2, 2));

  /** Create a date N days from the reference date */
  const daysFromRef = (days: number): Date =>
    new Date(REFERENCE_DATE.getTime() + days * 24 * 60 * 60 * 1000);

  /** Create a COMPRA-type planned order input */
  const makeCompraInput = (
    overrides?: Partial<PlannedOrderInput>,
  ): PlannedOrderInput => ({
    produtoId: 'prod-mp-001',
    tipoProduto: 'MATERIA_PRIMA',
    quantity: 100,
    dataNecessidade: daysFromRef(14),
    ...overrides,
  });

  /** Create a PRODUCAO-type planned order input */
  const makeProducaoInput = (
    overrides?: Partial<PlannedOrderInput>,
  ): PlannedOrderInput => ({
    produtoId: 'prod-ac-001',
    tipoProduto: 'ACABADO',
    quantity: 50,
    dataNecessidade: daysFromRef(21),
    ...overrides,
  });

  /** Create a full OrderGenerationInput */
  const makeInput = (
    overrides?: Partial<OrderGenerationInput> & {
      plannedOrders?: readonly PlannedOrderInput[];
    },
  ): OrderGenerationInput => ({
    execucaoId: 'exec-001',
    referenceDate: REFERENCE_DATE,
    plannedOrders: [makeCompraInput()],
    ...overrides,
  });

  /** Setup a principal supplier mock */
  const setupPrincipalSupplier = (
    overrides?: {
      fornecedorId?: string;
      leadTimeDias?: number | null;
      precoUnitario?: ReturnType<typeof mockDecimal> | null;
      leadTimePadraoDias?: number | null;
    },
  ) => {
    const record = {
      fornecedorId: overrides?.fornecedorId ?? 'forn-001',
      leadTimeDias:
        overrides !== undefined && 'leadTimeDias' in overrides
          ? overrides.leadTimeDias
          : 7,
      precoUnitario:
        overrides !== undefined && 'precoUnitario' in overrides
          ? overrides.precoUnitario
          : mockDecimal(10.5),
      isPrincipal: true,
      fornecedor: {
        leadTimePadraoDias:
          overrides !== undefined && 'leadTimePadraoDias' in overrides
            ? overrides.leadTimePadraoDias
            : 5,
      },
    };
    mockPrismaService.produtoFornecedor.findFirst.mockResolvedValue(record);
  };

  /** Setup a cheapest supplier mock (isPrincipal not found) */
  const setupCheapestSupplier = (
    overrides?: {
      fornecedorId?: string;
      leadTimeDias?: number | null;
      precoUnitario?: ReturnType<typeof mockDecimal> | null;
      leadTimePadraoDias?: number | null;
    },
  ) => {
    const record = {
      fornecedorId: overrides?.fornecedorId ?? 'forn-002',
      leadTimeDias:
        overrides !== undefined && 'leadTimeDias' in overrides
          ? overrides.leadTimeDias
          : 10,
      precoUnitario:
        overrides !== undefined && 'precoUnitario' in overrides
          ? overrides.precoUnitario
          : mockDecimal(8.25),
      isPrincipal: false,
      fornecedor: {
        leadTimePadraoDias:
          overrides !== undefined && 'leadTimePadraoDias' in overrides
            ? overrides.leadTimePadraoDias
            : 14,
      },
    };
    // First call (isPrincipal=true) returns null, second call returns cheapest
    mockPrismaService.produtoFornecedor.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(record);
  };

  /** Setup routing steps mock */
  const setupRoutingSteps = (
    steps?: {
      centroTrabalhoId?: string;
      sequencia?: number;
      tempoSetupMinutos?: ReturnType<typeof mockDecimal>;
      tempoUnitarioMinutos?: ReturnType<typeof mockDecimal>;
      custoHora?: ReturnType<typeof mockDecimal> | null;
    }[],
  ) => {
    const defaultSteps = [
      {
        centroTrabalhoId: 'ct-001',
        sequencia: 1,
        tempoSetupMinutos: mockDecimal(30),
        tempoUnitarioMinutos: mockDecimal(2.5),
        centroTrabalho: {
          custoHora: mockDecimal(120),
        },
      },
    ];

    if (steps !== undefined) {
      const mapped = steps.map((s) => ({
        centroTrabalhoId: s.centroTrabalhoId ?? 'ct-001',
        sequencia: s.sequencia ?? 1,
        tempoSetupMinutos: s.tempoSetupMinutos ?? mockDecimal(0),
        tempoUnitarioMinutos: s.tempoUnitarioMinutos ?? mockDecimal(0),
        centroTrabalho: {
          custoHora: s.custoHora ?? null,
        },
      }));
      mockPrismaService.roteiroProducao.findMany.mockResolvedValue(mapped);
    } else {
      mockPrismaService.roteiroProducao.findMany.mockResolvedValue(defaultSteps);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // Test 1: COMPRA with isPrincipal supplier (AC-2, AC-4)
  // ────────────────────────────────────────────────────────────────

  describe('COMPRA order with isPrincipal supplier — AC-2, AC-4', () => {
    it('should create COMPRA order using principal supplier', async () => {
      setupPrincipalSupplier();

      const input = makeInput({
        plannedOrders: [makeCompraInput()],
      });

      const result = await service.generateOrders(input);

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].tipo).toBe('COMPRA');
      expect(result.orders[0].fornecedorId).toBe('forn-001');
      expect(result.orders[0].centroTrabalhoId).toBeNull();
      expect(result.orders[0].status).toBe('PLANEJADA');
    });

    it('should classify MATERIA_PRIMA as COMPRA', async () => {
      setupPrincipalSupplier();
      const input = makeInput({
        plannedOrders: [makeCompraInput({ tipoProduto: 'MATERIA_PRIMA' })],
      });
      const result = await service.generateOrders(input);
      expect(result.orders[0].tipo).toBe('COMPRA');
    });

    it('should classify INSUMO as COMPRA', async () => {
      setupPrincipalSupplier();
      const input = makeInput({
        plannedOrders: [makeCompraInput({ tipoProduto: 'INSUMO' })],
      });
      const result = await service.generateOrders(input);
      expect(result.orders[0].tipo).toBe('COMPRA');
    });

    it('should classify EMBALAGEM as COMPRA', async () => {
      setupPrincipalSupplier();
      const input = makeInput({
        plannedOrders: [makeCompraInput({ tipoProduto: 'EMBALAGEM' })],
      });
      const result = await service.generateOrders(input);
      expect(result.orders[0].tipo).toBe('COMPRA');
    });

    it('should classify REVENDA as COMPRA', async () => {
      setupPrincipalSupplier();
      const input = makeInput({
        plannedOrders: [makeCompraInput({ tipoProduto: 'REVENDA' })],
      });
      const result = await service.generateOrders(input);
      expect(result.orders[0].tipo).toBe('COMPRA');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 2: COMPRA with fallback to lowest precoUnitario (AC-4)
  // ────────────────────────────────────────────────────────────────

  describe('COMPRA order fallback to lowest precoUnitario — AC-4', () => {
    it('should use cheapest supplier when no isPrincipal supplier exists', async () => {
      setupCheapestSupplier();

      const input = makeInput({
        plannedOrders: [makeCompraInput()],
      });

      const result = await service.generateOrders(input);

      expect(result.orders[0].fornecedorId).toBe('forn-002');
      // Should have queried isPrincipal first, then cheapest
      expect(mockPrismaService.produtoFornecedor.findFirst).toHaveBeenCalledTimes(2);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 3: No supplier found (AC-4)
  // ────────────────────────────────────────────────────────────────

  describe('No supplier found — AC-4', () => {
    it('should create COMPRA order with null fornecedorId and warning', async () => {
      mockPrismaService.produtoFornecedor.findFirst.mockResolvedValue(null);

      const input = makeInput({
        plannedOrders: [makeCompraInput()],
      });

      const result = await service.generateOrders(input);

      expect(result.orders[0].fornecedorId).toBeNull();
      expect(result.orders[0].custoEstimado).toBeNull();
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('No supplier found'))).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 4: COMPRA cost = qty * precoUnitario (AC-5)
  // ────────────────────────────────────────────────────────────────

  describe('COMPRA cost estimation — AC-5', () => {
    it('should calculate custoEstimado = quantity * precoUnitario', async () => {
      setupPrincipalSupplier({ precoUnitario: mockDecimal(15) });

      const input = makeInput({
        plannedOrders: [makeCompraInput({ quantity: 200 })],
      });

      const result = await service.generateOrders(input);

      // 200 * 15 = 3000
      expect(result.orders[0].custoEstimado).toBe(3000);
    });

    it('should handle decimal precoUnitario with 4 decimal precision', async () => {
      setupPrincipalSupplier({ precoUnitario: mockDecimal(12.3456) });

      const input = makeInput({
        plannedOrders: [makeCompraInput({ quantity: 3 })],
      });

      const result = await service.generateOrders(input);

      // 3 * 12.3456 = 37.0368
      expect(result.orders[0].custoEstimado).toBe(37.0368);
    });

    it('should set custoEstimado to null when precoUnitario is null', async () => {
      setupPrincipalSupplier({ precoUnitario: null });

      const input = makeInput({
        plannedOrders: [makeCompraInput()],
      });

      const result = await service.generateOrders(input);

      expect(result.orders[0].custoEstimado).toBeNull();
      expect(result.warnings.some((w) => w.includes('No precoUnitario'))).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 5: PRODUCAO order with routing (AC-3, AC-6)
  // ────────────────────────────────────────────────────────────────

  describe('PRODUCAO order with routing — AC-3, AC-6', () => {
    it('should create PRODUCAO order for ACABADO product', async () => {
      setupRoutingSteps();

      const input = makeInput({
        plannedOrders: [makeProducaoInput()],
      });

      const result = await service.generateOrders(input);

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].tipo).toBe('PRODUCAO');
      expect(result.orders[0].centroTrabalhoId).toBe('ct-001');
      expect(result.orders[0].fornecedorId).toBeNull();
      expect(result.orders[0].status).toBe('PLANEJADA');
    });

    it('should create PRODUCAO order for SEMI_ACABADO product', async () => {
      setupRoutingSteps();

      const input = makeInput({
        plannedOrders: [makeProducaoInput({ tipoProduto: 'SEMI_ACABADO' })],
      });

      const result = await service.generateOrders(input);

      expect(result.orders[0].tipo).toBe('PRODUCAO');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 6: PRODUCAO cost calculation (AC-7)
  // ────────────────────────────────────────────────────────────────

  describe('PRODUCAO cost estimation — AC-7', () => {
    it('should calculate cost = (setup + qty * unitTime) / 60 * custoHora', async () => {
      setupRoutingSteps([
        {
          centroTrabalhoId: 'ct-001',
          sequencia: 1,
          tempoSetupMinutos: mockDecimal(30),
          tempoUnitarioMinutos: mockDecimal(2),
          custoHora: mockDecimal(100),
        },
      ]);

      const input = makeInput({
        plannedOrders: [makeProducaoInput({ quantity: 10 })],
      });

      const result = await service.generateOrders(input);

      // hours = (30 + 10 * 2) / 60 = 50 / 60 = 0.8333
      // cost = 0.8333 * 100 = 83.33
      // With 4 decimal rounding:
      //   hours = round((30 + 20) / 60) = round(0.833333...) = 0.8333
      //   cost = round(0.8333 * 100) = round(83.33) = 83.33
      expect(result.orders[0].custoEstimado).toBe(83.33);
    });

    it('should sum costs across multiple routing steps', async () => {
      setupRoutingSteps([
        {
          centroTrabalhoId: 'ct-001',
          sequencia: 1,
          tempoSetupMinutos: mockDecimal(10),
          tempoUnitarioMinutos: mockDecimal(1),
          custoHora: mockDecimal(60),
        },
        {
          centroTrabalhoId: 'ct-002',
          sequencia: 2,
          tempoSetupMinutos: mockDecimal(5),
          tempoUnitarioMinutos: mockDecimal(0.5),
          custoHora: mockDecimal(80),
        },
      ]);

      const input = makeInput({
        plannedOrders: [makeProducaoInput({ quantity: 20 })],
      });

      const result = await service.generateOrders(input);

      // Step 1: hours = round((10 + 20*1) / 60) = round(30/60) = 0.5
      //         cost1 = round(0.5 * 60) = 30
      // Step 2: hours = round((5 + 20*0.5) / 60) = round(15/60) = 0.25
      //         cost2 = round(0.25 * 80) = 20
      // Total: round(30 + 20) = 50
      expect(result.orders[0].custoEstimado).toBe(50);
    });

    it('should handle custoHora = null for a step — skip that step cost', async () => {
      setupRoutingSteps([
        {
          centroTrabalhoId: 'ct-001',
          sequencia: 1,
          tempoSetupMinutos: mockDecimal(10),
          tempoUnitarioMinutos: mockDecimal(1),
          custoHora: mockDecimal(60),
        },
        {
          centroTrabalhoId: 'ct-002',
          sequencia: 2,
          tempoSetupMinutos: mockDecimal(5),
          tempoUnitarioMinutos: mockDecimal(0.5),
          custoHora: null,
        },
      ]);

      const input = makeInput({
        plannedOrders: [makeProducaoInput({ quantity: 20 })],
      });

      const result = await service.generateOrders(input);

      // Only step 1 contributes to cost
      // hours = round((10 + 20*1) / 60) = 0.5
      // cost = round(0.5 * 60) = 30
      expect(result.orders[0].custoEstimado).toBe(30);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 7: PRODUCAO centroTrabalhoId from first step (AC-6)
  // ────────────────────────────────────────────────────────────────

  describe('PRODUCAO centroTrabalhoId from first routing step — AC-6', () => {
    it('should use centroTrabalhoId from the step with lowest sequencia', async () => {
      setupRoutingSteps([
        {
          centroTrabalhoId: 'ct-first',
          sequencia: 1,
          tempoSetupMinutos: mockDecimal(10),
          tempoUnitarioMinutos: mockDecimal(1),
          custoHora: mockDecimal(50),
        },
        {
          centroTrabalhoId: 'ct-second',
          sequencia: 2,
          tempoSetupMinutos: mockDecimal(5),
          tempoUnitarioMinutos: mockDecimal(0.5),
          custoHora: mockDecimal(80),
        },
      ]);

      const input = makeInput({
        plannedOrders: [makeProducaoInput()],
      });

      const result = await service.generateOrders(input);

      expect(result.orders[0].centroTrabalhoId).toBe('ct-first');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 8: Release date offset (AC-8)
  // ────────────────────────────────────────────────────────────────

  describe('Release date offset by lead time — AC-8', () => {
    it('should calculate dataLiberacao = dataNecessidade - leadTimeDias', async () => {
      setupPrincipalSupplier({ leadTimeDias: 7 });

      const dataNecessidade = daysFromRef(14); // ref + 14 days
      const input = makeInput({
        plannedOrders: [makeCompraInput({ dataNecessidade })],
      });

      const result = await service.generateOrders(input);

      // dataLiberacao = dataNecessidade - 7 = ref + 7
      const expectedRelease = daysFromRef(7);
      expect(result.orders[0].dataLiberacao.getTime()).toBe(expectedRelease.getTime());
    });

    it('should use supplier leadTimeDias from ProdutoFornecedor', async () => {
      setupPrincipalSupplier({ leadTimeDias: 10, leadTimePadraoDias: 5 });

      const dataNecessidade = daysFromRef(20);
      const input = makeInput({
        plannedOrders: [makeCompraInput({ dataNecessidade })],
      });

      const result = await service.generateOrders(input);

      // Should use ProdutoFornecedor.leadTimeDias (10), not Fornecedor.leadTimePadraoDias (5)
      const expectedRelease = daysFromRef(10);
      expect(result.orders[0].dataLiberacao.getTime()).toBe(expectedRelease.getTime());
    });

    it('should fallback to Fornecedor.leadTimePadraoDias when ProdutoFornecedor.leadTimeDias is null', async () => {
      setupPrincipalSupplier({ leadTimeDias: null, leadTimePadraoDias: 5 });

      const dataNecessidade = daysFromRef(20);
      const input = makeInput({
        plannedOrders: [makeCompraInput({ dataNecessidade })],
      });

      const result = await service.generateOrders(input);

      // Should fallback to Fornecedor.leadTimePadraoDias (5)
      const expectedRelease = daysFromRef(15);
      expect(result.orders[0].dataLiberacao.getTime()).toBe(expectedRelease.getTime());
    });

    it('should use product leadTimeProducaoDias for PRODUCAO orders', async () => {
      setupRoutingSteps();
      mockPrismaService.produto.findUnique.mockResolvedValue({
        leadTimeProducaoDias: 5,
      });

      const dataNecessidade = daysFromRef(21);
      const input = makeInput({
        plannedOrders: [makeProducaoInput({ dataNecessidade })],
      });

      const result = await service.generateOrders(input);

      const expectedRelease = daysFromRef(16);
      expect(result.orders[0].dataLiberacao.getTime()).toBe(expectedRelease.getTime());
    });

    it('should set dataLiberacao = dataNecessidade when no lead time (0)', async () => {
      mockPrismaService.produtoFornecedor.findFirst.mockResolvedValue(null);

      const dataNecessidade = daysFromRef(14);
      const input = makeInput({
        plannedOrders: [makeCompraInput({ dataNecessidade })],
      });

      const result = await service.generateOrders(input);

      // No supplier → leadTime = 0 → dataLiberacao = dataNecessidade
      expect(result.orders[0].dataLiberacao.getTime()).toBe(dataNecessidade.getTime());
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 9: Priority CRITICA — past due (AC-9)
  // ────────────────────────────────────────────────────────────────

  describe('Priority CRITICA — past due — AC-9', () => {
    it('should assign CRITICA when dataLiberacao < referenceDate', async () => {
      // Set up a supplier with long lead time so release date is in the past
      setupPrincipalSupplier({ leadTimeDias: 20 });

      const dataNecessidade = daysFromRef(5); // ref + 5
      // dataLiberacao = ref + 5 - 20 = ref - 15 → past due!
      const input = makeInput({
        plannedOrders: [makeCompraInput({ dataNecessidade })],
      });

      const result = await service.generateOrders(input);

      expect(result.orders[0].prioridade).toBe('CRITICA');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 10: Priority ALTA — within 7 days (AC-9)
  // ────────────────────────────────────────────────────────────────

  describe('Priority ALTA — within 7 days — AC-9', () => {
    it('should assign ALTA when dataLiberacao < referenceDate + 7 days', async () => {
      setupPrincipalSupplier({ leadTimeDias: 5 });

      // dataNecessidade = ref + 8, dataLiberacao = ref + 8 - 5 = ref + 3 → within 7 days
      const dataNecessidade = daysFromRef(8);
      const input = makeInput({
        plannedOrders: [makeCompraInput({ dataNecessidade })],
      });

      const result = await service.generateOrders(input);

      expect(result.orders[0].prioridade).toBe('ALTA');
    });

    it('should assign ALTA when dataLiberacao equals referenceDate (exactly today)', async () => {
      setupPrincipalSupplier({ leadTimeDias: 10 });

      // dataNecessidade = ref + 10, dataLiberacao = ref + 10 - 10 = ref → exactly today
      const dataNecessidade = daysFromRef(10);
      const input = makeInput({
        plannedOrders: [makeCompraInput({ dataNecessidade })],
      });

      const result = await service.generateOrders(input);

      // dataLiberacao == refDate → not < refDate → not CRITICA
      // dataLiberacao < refDate + 7 → ALTA
      expect(result.orders[0].prioridade).toBe('ALTA');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 11: Priority MEDIA / BAIXA (AC-9)
  // ────────────────────────────────────────────────────────────────

  describe('Priority MEDIA / BAIXA — AC-9', () => {
    it('should assign MEDIA when dataLiberacao is between 7 and 14 days from reference', async () => {
      setupPrincipalSupplier({ leadTimeDias: 3 });

      // dataNecessidade = ref + 13, dataLiberacao = ref + 13 - 3 = ref + 10
      const dataNecessidade = daysFromRef(13);
      const input = makeInput({
        plannedOrders: [makeCompraInput({ dataNecessidade })],
      });

      const result = await service.generateOrders(input);

      expect(result.orders[0].prioridade).toBe('MEDIA');
    });

    it('should assign BAIXA when dataLiberacao >= referenceDate + 14 days', async () => {
      setupPrincipalSupplier({ leadTimeDias: 3 });

      // dataNecessidade = ref + 30, dataLiberacao = ref + 30 - 3 = ref + 27
      const dataNecessidade = daysFromRef(30);
      const input = makeInput({
        plannedOrders: [makeCompraInput({ dataNecessidade })],
      });

      const result = await service.generateOrders(input);

      expect(result.orders[0].prioridade).toBe('BAIXA');
    });

    it('should assign MEDIA at exactly 7 days boundary', async () => {
      setupPrincipalSupplier({ leadTimeDias: 0 });

      // dataNecessidade = ref + 7, dataLiberacao = ref + 7
      const dataNecessidade = daysFromRef(7);
      const input = makeInput({
        plannedOrders: [makeCompraInput({ dataNecessidade })],
      });

      const result = await service.generateOrders(input);

      // dataLiberacao = ref + 7 → not < ref + 7 → not ALTA
      // dataLiberacao < ref + 14 → MEDIA
      expect(result.orders[0].prioridade).toBe('MEDIA');
    });

    it('should assign BAIXA at exactly 14 days boundary', async () => {
      setupPrincipalSupplier({ leadTimeDias: 0 });

      // dataNecessidade = ref + 14, dataLiberacao = ref + 14
      const dataNecessidade = daysFromRef(14);
      const input = makeInput({
        plannedOrders: [makeCompraInput({ dataNecessidade })],
      });

      const result = await service.generateOrders(input);

      // dataLiberacao = ref + 14 → not < ref + 14 → BAIXA
      expect(result.orders[0].prioridade).toBe('BAIXA');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 12: Multiple orders across periods (AC-1)
  // ────────────────────────────────────────────────────────────────

  describe('Multiple orders across periods — AC-1', () => {
    it('should process both COMPRA and PRODUCAO orders in a single call', async () => {
      // Setup supplier for COMPRA
      setupPrincipalSupplier();
      // Setup routing for PRODUCAO
      setupRoutingSteps();

      const input = makeInput({
        plannedOrders: [
          makeCompraInput({ produtoId: 'mp-001', quantity: 100 }),
          makeCompraInput({ produtoId: 'mp-002', tipoProduto: 'INSUMO', quantity: 50 }),
          makeProducaoInput({ produtoId: 'ac-001', quantity: 200 }),
        ],
      });

      const result = await service.generateOrders(input);

      expect(result.orders).toHaveLength(3);
      expect(result.totalCompraOrders).toBe(2);
      expect(result.totalProducaoOrders).toBe(1);
    });

    it('should calculate totalCustoEstimado across all orders', async () => {
      // Supplier with precoUnitario = 10
      setupPrincipalSupplier({ precoUnitario: mockDecimal(10) });

      const input = makeInput({
        plannedOrders: [
          makeCompraInput({ quantity: 100 }), // cost = 100 * 10 = 1000
          makeCompraInput({ quantity: 200 }), // cost = 200 * 10 = 2000
        ],
      });

      const result = await service.generateOrders(input);

      expect(result.totalCustoEstimado).toBe(3000);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 13: Persistence — createMany called correctly (AC-11)
  // ────────────────────────────────────────────────────────────────

  describe('Persistence — createMany — AC-11', () => {
    it('should call prisma.ordemPlanejada.createMany with all generated orders', async () => {
      setupPrincipalSupplier();

      const input = makeInput({
        execucaoId: 'exec-persist-001',
        plannedOrders: [
          makeCompraInput({ quantity: 100 }),
          makeCompraInput({ quantity: 200 }),
        ],
      });

      await service.generateOrders(input);

      expect(mockPrismaService.ordemPlanejada.createMany).toHaveBeenCalledTimes(1);

      const createCall = mockPrismaService.ordemPlanejada.createMany.mock.calls[0][0];
      expect(createCall.data).toHaveLength(2);
      expect(createCall.data[0].execucaoId).toBe('exec-persist-001');
      expect(createCall.data[0].status).toBe('PLANEJADA');
      expect(createCall.data[1].execucaoId).toBe('exec-persist-001');
      expect(createCall.data[1].status).toBe('PLANEJADA');
    });

    it('should not call createMany when there are no orders', async () => {
      const input = makeInput({
        plannedOrders: [],
      });

      await service.generateOrders(input);

      expect(mockPrismaService.ordemPlanejada.createMany).not.toHaveBeenCalled();
    });

    it('should persist correct tipo for COMPRA and PRODUCAO orders', async () => {
      setupPrincipalSupplier();
      setupRoutingSteps();

      const input = makeInput({
        plannedOrders: [
          makeCompraInput(),
          makeProducaoInput(),
        ],
      });

      await service.generateOrders(input);

      const createCall = mockPrismaService.ordemPlanejada.createMany.mock.calls[0][0];
      expect(createCall.data[0].tipo).toBe('COMPRA');
      expect(createCall.data[1].tipo).toBe('PRODUCAO');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 14: execucaoId linked to all orders (AC-10)
  // ────────────────────────────────────────────────────────────────

  describe('execucaoId linked to all orders — AC-10', () => {
    it('should return the execucaoId in the output', async () => {
      setupPrincipalSupplier();

      const input = makeInput({ execucaoId: 'exec-link-test' });

      const result = await service.generateOrders(input);

      expect(result.execucaoId).toBe('exec-link-test');
    });

    it('should persist execucaoId in every order record', async () => {
      setupPrincipalSupplier();
      setupRoutingSteps();

      const input = makeInput({
        execucaoId: 'exec-link-all',
        plannedOrders: [makeCompraInput(), makeProducaoInput()],
      });

      await service.generateOrders(input);

      const createCall = mockPrismaService.ordemPlanejada.createMany.mock.calls[0][0];
      for (const orderData of createCall.data) {
        expect(orderData.execucaoId).toBe('exec-link-all');
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 15: Unknown tipoProduto (edge case)
  // ────────────────────────────────────────────────────────────────

  describe('Unknown tipoProduto — edge case', () => {
    it('should skip unknown product types and add warning', async () => {
      const input = makeInput({
        plannedOrders: [
          makeCompraInput({ tipoProduto: 'DESCONHECIDO' }),
        ],
      });

      const result = await service.generateOrders(input);

      expect(result.orders).toHaveLength(0);
      expect(result.warnings.some((w) => w.includes('Unknown tipoProduto'))).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 16: PRODUCAO with no routing steps
  // ────────────────────────────────────────────────────────────────

  describe('PRODUCAO with no routing steps', () => {
    it('should create order with null centroTrabalhoId and warning', async () => {
      mockPrismaService.roteiroProducao.findMany.mockResolvedValue([]);

      const input = makeInput({
        plannedOrders: [makeProducaoInput()],
      });

      const result = await service.generateOrders(input);

      expect(result.orders[0].centroTrabalhoId).toBeNull();
      expect(result.orders[0].custoEstimado).toBeNull();
      expect(result.warnings.some((w) => w.includes('No routing steps'))).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 17: lotificacaoUsada pass-through
  // ────────────────────────────────────────────────────────────────

  describe('lotificacaoUsada pass-through', () => {
    it('should include lotificacaoUsada from input in generated order', async () => {
      setupPrincipalSupplier();

      const input = makeInput({
        plannedOrders: [makeCompraInput({ lotificacaoUsada: 'EOQ' })],
      });

      const result = await service.generateOrders(input);

      expect(result.orders[0].lotificacaoUsada).toBe('EOQ');
    });

    it('should set lotificacaoUsada to null when not provided', async () => {
      setupPrincipalSupplier();

      const input = makeInput({
        plannedOrders: [makeCompraInput()],
      });

      const result = await service.generateOrders(input);

      expect(result.orders[0].lotificacaoUsada).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // isPurchasedItem / isProducedItem — direct unit tests
  // ────────────────────────────────────────────────────────────────

  describe('isPurchasedItem — classification', () => {
    it.each([
      ['MATERIA_PRIMA', true],
      ['INSUMO', true],
      ['EMBALAGEM', true],
      ['REVENDA', true],
      ['ACABADO', false],
      ['SEMI_ACABADO', false],
      ['UNKNOWN', false],
    ])('isPurchasedItem("%s") should return %s', (tipo, expected) => {
      expect(service.isPurchasedItem(tipo)).toBe(expected);
    });
  });

  describe('isProducedItem — classification', () => {
    it.each([
      ['ACABADO', true],
      ['SEMI_ACABADO', true],
      ['MATERIA_PRIMA', false],
      ['INSUMO', false],
      ['EMBALAGEM', false],
      ['REVENDA', false],
      ['UNKNOWN', false],
    ])('isProducedItem("%s") should return %s', (tipo, expected) => {
      expect(service.isProducedItem(tipo)).toBe(expected);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // assignPriority — direct unit tests
  // ────────────────────────────────────────────────────────────────

  describe('assignPriority — direct', () => {
    it('should return CRITICA for past-due release date', () => {
      const release = new Date(REFERENCE_DATE.getTime() - 1);
      expect(service.assignPriority(release, REFERENCE_DATE)).toBe('CRITICA');
    });

    it('should return ALTA for release date = referenceDate', () => {
      expect(service.assignPriority(REFERENCE_DATE, REFERENCE_DATE)).toBe('ALTA');
    });

    it('should return ALTA for release date < referenceDate + 7', () => {
      const release = daysFromRef(6);
      expect(service.assignPriority(release, REFERENCE_DATE)).toBe('ALTA');
    });

    it('should return MEDIA for release date = referenceDate + 7', () => {
      const release = daysFromRef(7);
      expect(service.assignPriority(release, REFERENCE_DATE)).toBe('MEDIA');
    });

    it('should return MEDIA for release date < referenceDate + 14', () => {
      const release = daysFromRef(13);
      expect(service.assignPriority(release, REFERENCE_DATE)).toBe('MEDIA');
    });

    it('should return BAIXA for release date = referenceDate + 14', () => {
      const release = daysFromRef(14);
      expect(service.assignPriority(release, REFERENCE_DATE)).toBe('BAIXA');
    });

    it('should return BAIXA for release date > referenceDate + 14', () => {
      const release = daysFromRef(30);
      expect(service.assignPriority(release, REFERENCE_DATE)).toBe('BAIXA');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // calculateReleaseDate — direct unit tests
  // ────────────────────────────────────────────────────────────────

  describe('calculateReleaseDate — direct', () => {
    it('should offset date back by lead time days', () => {
      const need = daysFromRef(20);
      const release = service.calculateReleaseDate(need, 5);
      expect(release.getTime()).toBe(daysFromRef(15).getTime());
    });

    it('should return same date when leadTimeDias = 0', () => {
      const need = daysFromRef(10);
      const release = service.calculateReleaseDate(need, 0);
      expect(release.getTime()).toBe(need.getTime());
    });

    it('should allow release date before reference (past due)', () => {
      const need = daysFromRef(3);
      const release = service.calculateReleaseDate(need, 10);
      // ref + 3 - 10 = ref - 7
      expect(release.getTime()).toBe(daysFromRef(-7).getTime());
    });
  });

  // ────────────────────────────────────────────────────────────────
  // dataRecebimentoEsperado = dataNecessidade
  // ────────────────────────────────────────────────────────────────

  describe('dataRecebimentoEsperado', () => {
    it('should equal dataNecessidade for COMPRA orders', async () => {
      setupPrincipalSupplier();

      const dataNecessidade = daysFromRef(14);
      const input = makeInput({
        plannedOrders: [makeCompraInput({ dataNecessidade })],
      });

      const result = await service.generateOrders(input);

      expect(result.orders[0].dataRecebimentoEsperado.getTime()).toBe(
        dataNecessidade.getTime(),
      );
    });

    it('should equal dataNecessidade for PRODUCAO orders', async () => {
      setupRoutingSteps();

      const dataNecessidade = daysFromRef(21);
      const input = makeInput({
        plannedOrders: [makeProducaoInput({ dataNecessidade })],
      });

      const result = await service.generateOrders(input);

      expect(result.orders[0].dataRecebimentoEsperado.getTime()).toBe(
        dataNecessidade.getTime(),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Default referenceDate
  // ────────────────────────────────────────────────────────────────

  describe('Default referenceDate', () => {
    it('should use current date when referenceDate is not provided', async () => {
      setupPrincipalSupplier({ leadTimeDias: 0 });

      const dataNecessidade = new Date(Date.UTC(2099, 0, 1)); // far future → BAIXA
      const input: OrderGenerationInput = {
        execucaoId: 'exec-default-ref',
        plannedOrders: [makeCompraInput({ dataNecessidade })],
        // referenceDate intentionally omitted
      };

      const result = await service.generateOrders(input);

      // Far future date → should be BAIXA regardless of what "today" is
      expect(result.orders[0].prioridade).toBe('BAIXA');
    });
  });
});
