import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../prisma/prisma.service';
import { StorageValidationService } from './storage-validation.service';
import type { StorageValidationInput } from './interfaces/storage-validation.interface';

/**
 * Unit tests for StorageValidationService — Storage Capacity Validation Engine
 *
 * Test cases cover all Storage ACs from Story 3.9:
 *   1.  <90% utilization: severity = OK (AC-10)
 *   2.  90-95% utilization: severity = ALERT (AC-10)
 *   3.  >95% utilization: severity = CRITICAL (AC-10)
 *   4.  Incoming material increases projected volume (AC-9)
 *   5.  Outgoing material decreases projected volume (AC-9)
 *   6.  No capacity defined (null): skip deposito (AC-8)
 *   7.  Multiple depositos processed independently (AC-8)
 *   8.  Alert includes depositoId, week, utilization, severity (AC-11)
 *   9.  Does not modify planned orders — read-only (AC-12)
 *   10. Cumulative projection across weeks (AC-9)
 *
 * @see Story 3.9 — CRP & Storage Capacity Validation
 * @see FR-041 — Storage Capacity Validation
 */
describe('StorageValidationService', () => {
  let service: StorageValidationService;

  // ────────────────────────────────────────────────────────────────
  // Mock Setup
  // ────────────────────────────────────────────────────────────────

  const mockPrismaService = {
    deposito: {
      findMany: jest.fn(),
    },
    inventarioAtual: {
      findMany: jest.fn(),
    },
    produto: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageValidationService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<StorageValidationService>(StorageValidationService);
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

  /** Monday 2026-03-02 UTC */
  const WEEK1_START = new Date(Date.UTC(2026, 2, 2));
  /** Monday 2026-03-09 UTC */
  const WEEK1_END = new Date(Date.UTC(2026, 2, 9));
  /** Monday 2026-03-16 UTC */
  const WEEK2_END = new Date(Date.UTC(2026, 2, 16));

  /** Create a standard weekly bucket */
  const makeWeeklyBucket = (
    start: Date = WEEK1_START,
    end: Date = WEEK1_END,
  ) => ({
    periodStart: start,
    periodEnd: end,
  });

  /** Create a StorageValidationInput */
  const makeInput = (
    overrides?: Partial<StorageValidationInput>,
  ): StorageValidationInput => ({
    weeklyBuckets: [makeWeeklyBucket()],
    plannedReceipts: [],
    grossRequirements: [],
    ...overrides,
  });

  /**
   * Setup depositos mock.
   * Default: 1 deposito with 100 m3 capacity.
   */
  const setupDepositos = (
    depositos?: {
      id?: string;
      codigo?: string;
      nome?: string;
      capacidadeM3?: ReturnType<typeof mockDecimal> | null;
    }[],
  ) => {
    const defaults = [
      {
        id: 'dep-001',
        codigo: 'DEP-001',
        nome: 'Deposito 1',
        capacidadeM3: mockDecimal(100),
      },
    ];

    mockPrismaService.deposito.findMany.mockResolvedValue(
      (depositos ?? defaults).map((d) => ({
        id: d.id ?? 'dep-001',
        codigo: d.codigo ?? 'DEP-001',
        nome: d.nome ?? 'Deposito 1',
        capacidadeM3: d.capacidadeM3 ?? mockDecimal(100),
      })),
    );
  };

  /**
   * Setup current inventory mock.
   */
  const setupInventory = (
    records?: {
      depositoId?: string;
      produtoId?: string;
      quantidadeDisponivel?: ReturnType<typeof mockDecimal>;
    }[],
  ) => {
    mockPrismaService.inventarioAtual.findMany.mockResolvedValue(
      (records ?? []).map((r) => ({
        depositoId: r.depositoId ?? 'dep-001',
        produtoId: r.produtoId ?? 'prod-001',
        quantidadeDisponivel:
          r.quantidadeDisponivel ?? mockDecimal(0),
      })),
    );
  };

  /**
   * Setup product volumes mock.
   */
  const setupProductVolumes = (
    products?: {
      id?: string;
      volumeM3?: ReturnType<typeof mockDecimal>;
    }[],
  ) => {
    mockPrismaService.produto.findMany.mockResolvedValue(
      (products ?? []).map((p) => ({
        id: p.id ?? 'prod-001',
        volumeM3: p.volumeM3 ?? mockDecimal(0.5),
      })),
    );
  };

  // ────────────────────────────────────────────────────────────────
  // Test 1: <90% utilization → OK (AC-10)
  // ────────────────────────────────────────────────────────────────

  describe('<90% utilization — OK — AC-10', () => {
    it('should return severity OK when utilization is below 90%', async () => {
      // Capacity: 100 m3
      // Inventory: 100 units of product with 0.5 m3 each = 50 m3
      // Utilization: 50/100 * 100 = 50% → OK
      setupDepositos();
      setupInventory([
        {
          depositoId: 'dep-001',
          produtoId: 'prod-001',
          quantidadeDisponivel: mockDecimal(100),
        },
      ]);
      setupProductVolumes([{ id: 'prod-001', volumeM3: mockDecimal(0.5) }]);

      const result = await service.validateStorage(makeInput());

      expect(result.depositos).toHaveLength(1);
      const week = result.depositos[0].weeklyResults[0];
      expect(week.projectedVolumeM3).toBe(50);
      expect(week.capacityM3).toBe(100);
      expect(week.utilizationPercentual).toBe(50);
      expect(week.severity).toBe('OK');
      expect(result.totalAlerts).toBe(0);
      expect(result.totalCriticals).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 2: 90-95% utilization → ALERT (AC-10)
  // ────────────────────────────────────────────────────────────────

  describe('90-95% utilization — ALERT — AC-10', () => {
    it('should return severity ALERT when utilization is between 90% and 95%', async () => {
      // Capacity: 100 m3
      // Inventory: 185 units * 0.5 m3 = 92.5 m3 → 92.5% → ALERT
      setupDepositos();
      setupInventory([
        {
          depositoId: 'dep-001',
          produtoId: 'prod-001',
          quantidadeDisponivel: mockDecimal(185),
        },
      ]);
      setupProductVolumes([{ id: 'prod-001', volumeM3: mockDecimal(0.5) }]);

      const result = await service.validateStorage(makeInput());

      const week = result.depositos[0].weeklyResults[0];
      expect(week.utilizationPercentual).toBe(92.5);
      expect(week.severity).toBe('ALERT');
      expect(result.depositos[0].hasAlert).toBe(true);
      expect(result.depositos[0].hasCritical).toBe(false);
      expect(result.totalAlerts).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 3: >95% utilization → CRITICAL (AC-10)
  // ────────────────────────────────────────────────────────────────

  describe('>95% utilization — CRITICAL — AC-10', () => {
    it('should return severity CRITICAL when utilization exceeds 95%', async () => {
      // Capacity: 100 m3
      // Inventory: 196 units * 0.5 m3 = 98 m3 → 98% → CRITICAL
      setupDepositos();
      setupInventory([
        {
          depositoId: 'dep-001',
          produtoId: 'prod-001',
          quantidadeDisponivel: mockDecimal(196),
        },
      ]);
      setupProductVolumes([{ id: 'prod-001', volumeM3: mockDecimal(0.5) }]);

      const result = await service.validateStorage(makeInput());

      const week = result.depositos[0].weeklyResults[0];
      expect(week.utilizationPercentual).toBe(98);
      expect(week.severity).toBe('CRITICAL');
      expect(result.depositos[0].hasCritical).toBe(true);
      expect(result.totalCriticals).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 4: Incoming material increases projected volume (AC-9)
  // ────────────────────────────────────────────────────────────────

  describe('Incoming material increases projected volume — AC-9', () => {
    it('should increase projected volume with planned receipts', async () => {
      // Start: 100 units * 0.5 m3 = 50 m3
      // Receipt: +60 units * 0.5 m3 = +30 m3
      // Projected: 50 + 30 = 80 m3 → 80% → OK
      setupDepositos();
      setupInventory([
        {
          depositoId: 'dep-001',
          produtoId: 'prod-001',
          quantidadeDisponivel: mockDecimal(100),
        },
      ]);
      setupProductVolumes([{ id: 'prod-001', volumeM3: mockDecimal(0.5) }]);

      const result = await service.validateStorage(
        makeInput({
          plannedReceipts: [
            {
              produtoId: 'prod-001',
              quantity: 60,
              date: new Date(Date.UTC(2026, 2, 4)),
            },
          ],
        }),
      );

      const week = result.depositos[0].weeklyResults[0];
      expect(week.projectedVolumeM3).toBe(80);
      expect(week.utilizationPercentual).toBe(80);
      expect(week.severity).toBe('OK');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 5: Outgoing material decreases projected volume (AC-9)
  // ────────────────────────────────────────────────────────────────

  describe('Outgoing material decreases projected volume — AC-9', () => {
    it('should decrease projected volume with gross requirements', async () => {
      // Start: 160 units * 0.5 m3 = 80 m3
      // Requirement: -40 units * 0.5 m3 = -20 m3
      // Projected: 80 - 20 = 60 m3 → 60% → OK
      setupDepositos();
      setupInventory([
        {
          depositoId: 'dep-001',
          produtoId: 'prod-001',
          quantidadeDisponivel: mockDecimal(160),
        },
      ]);
      setupProductVolumes([{ id: 'prod-001', volumeM3: mockDecimal(0.5) }]);

      const result = await service.validateStorage(
        makeInput({
          grossRequirements: [
            {
              produtoId: 'prod-001',
              quantity: 40,
              date: new Date(Date.UTC(2026, 2, 4)),
            },
          ],
        }),
      );

      const week = result.depositos[0].weeklyResults[0];
      expect(week.projectedVolumeM3).toBe(60);
      expect(week.utilizationPercentual).toBe(60);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 6: No capacity defined → skip deposito (AC-8)
  // ────────────────────────────────────────────────────────────────

  describe('No capacity defined — skip deposito — AC-8', () => {
    it('should return empty when no depositos with capacity exist', async () => {
      // The loadActiveDepositos query filters out null/0 capacity
      mockPrismaService.deposito.findMany.mockResolvedValue([]);

      const result = await service.validateStorage(makeInput());

      expect(result.depositos).toHaveLength(0);
      expect(result.totalAlerts).toBe(0);
      expect(result.totalCriticals).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 7: Multiple depositos processed independently (AC-8)
  // ────────────────────────────────────────────────────────────────

  describe('Multiple depositos processed independently — AC-8', () => {
    it('should process each deposito independently', async () => {
      // Deposito 1: 100 m3, inventory 50 m3 → 50% OK
      // Deposito 2: 50 m3, inventory 46 m3 → 92% ALERT
      setupDepositos([
        {
          id: 'dep-001',
          codigo: 'DEP-001',
          nome: 'Deposito 1',
          capacidadeM3: mockDecimal(100),
        },
        {
          id: 'dep-002',
          codigo: 'DEP-002',
          nome: 'Deposito 2',
          capacidadeM3: mockDecimal(50),
        },
      ]);

      setupInventory([
        {
          depositoId: 'dep-001',
          produtoId: 'prod-001',
          quantidadeDisponivel: mockDecimal(100), // 100 * 0.5 = 50 m3
        },
        {
          depositoId: 'dep-002',
          produtoId: 'prod-002',
          quantidadeDisponivel: mockDecimal(92), // 92 * 0.5 = 46 m3
        },
      ]);

      setupProductVolumes([
        { id: 'prod-001', volumeM3: mockDecimal(0.5) },
        { id: 'prod-002', volumeM3: mockDecimal(0.5) },
      ]);

      const result = await service.validateStorage(makeInput());

      expect(result.depositos).toHaveLength(2);

      // Deposito 1: 50% → OK
      expect(result.depositos[0].weeklyResults[0].utilizationPercentual).toBe(
        50,
      );
      expect(result.depositos[0].weeklyResults[0].severity).toBe('OK');
      expect(result.depositos[0].hasAlert).toBe(false);

      // Deposito 2: 92% → ALERT
      expect(result.depositos[1].weeklyResults[0].utilizationPercentual).toBe(
        92,
      );
      expect(result.depositos[1].weeklyResults[0].severity).toBe('ALERT');
      expect(result.depositos[1].hasAlert).toBe(true);

      expect(result.totalAlerts).toBe(1);
      expect(result.totalCriticals).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 8: Alert includes depositoId, week, utilization, severity (AC-11)
  // ────────────────────────────────────────────────────────────────

  describe('Alert includes required fields — AC-11', () => {
    it('should include depositoId, week (periodStart), utilization, severity', async () => {
      setupDepositos();
      setupInventory([
        {
          depositoId: 'dep-001',
          produtoId: 'prod-001',
          quantidadeDisponivel: mockDecimal(185),
        },
      ]);
      setupProductVolumes([{ id: 'prod-001', volumeM3: mockDecimal(0.5) }]);

      const result = await service.validateStorage(makeInput());

      // Check the deposito result has all AC-11 fields
      const depositoResult = result.depositos[0];
      expect(depositoResult.depositoId).toBe('dep-001');

      const weekResult = depositoResult.weeklyResults[0];
      expect(weekResult.periodStart).toEqual(WEEK1_START);
      expect(typeof weekResult.utilizationPercentual).toBe('number');
      expect(weekResult.severity).toBe('ALERT');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 9: Read-only — does not modify orders (AC-12)
  // ────────────────────────────────────────────────────────────────

  describe('Read-only — does not modify orders — AC-12', () => {
    it('should not call any mutation methods on Prisma models', async () => {
      setupDepositos();
      setupInventory([
        {
          depositoId: 'dep-001',
          produtoId: 'prod-001',
          quantidadeDisponivel: mockDecimal(100),
        },
      ]);
      setupProductVolumes([{ id: 'prod-001', volumeM3: mockDecimal(0.5) }]);

      await service.validateStorage(
        makeInput({
          plannedReceipts: [
            {
              produtoId: 'prod-001',
              quantity: 50,
              date: new Date(Date.UTC(2026, 2, 4)),
            },
          ],
          grossRequirements: [
            {
              produtoId: 'prod-001',
              quantity: 30,
              date: new Date(Date.UTC(2026, 2, 5)),
            },
          ],
        }),
      );

      // Only findMany was called — no create, update, delete
      expect(mockPrismaService.deposito.findMany).toHaveBeenCalled();
      expect(mockPrismaService.inventarioAtual.findMany).toHaveBeenCalled();
      expect(mockPrismaService.produto.findMany).toHaveBeenCalled();

      // Verify no mutation methods exist on our mocks
      const depositoMethods = Object.keys(mockPrismaService.deposito);
      expect(depositoMethods).toEqual(['findMany']);
      const inventarioMethods = Object.keys(mockPrismaService.inventarioAtual);
      expect(inventarioMethods).toEqual(['findMany']);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 10: Cumulative projection across weeks (AC-9)
  // ────────────────────────────────────────────────────────────────

  describe('Cumulative projection across weeks — AC-9', () => {
    it('should carry forward volume from week to week', async () => {
      // Start: 100 units * 0.5 = 50 m3
      // Week 1: +60 incoming → 50 + 30 = 80 m3
      // Week 2: -40 outgoing → 80 - 20 = 60 m3
      setupDepositos();
      setupInventory([
        {
          depositoId: 'dep-001',
          produtoId: 'prod-001',
          quantidadeDisponivel: mockDecimal(100),
        },
      ]);
      setupProductVolumes([{ id: 'prod-001', volumeM3: mockDecimal(0.5) }]);

      const result = await service.validateStorage(
        makeInput({
          weeklyBuckets: [
            makeWeeklyBucket(WEEK1_START, WEEK1_END),
            makeWeeklyBucket(WEEK1_END, WEEK2_END),
          ],
          plannedReceipts: [
            {
              produtoId: 'prod-001',
              quantity: 60,
              date: new Date(Date.UTC(2026, 2, 4)), // Week 1
            },
          ],
          grossRequirements: [
            {
              produtoId: 'prod-001',
              quantity: 40,
              date: new Date(Date.UTC(2026, 2, 10)), // Week 2
            },
          ],
        }),
      );

      // Week 1: 50 + 30 = 80 m3
      expect(result.depositos[0].weeklyResults[0].projectedVolumeM3).toBe(80);
      // Week 2: 80 - 20 = 60 m3 (cumulative)
      expect(result.depositos[0].weeklyResults[1].projectedVolumeM3).toBe(60);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // determineSeverity — direct unit tests
  // ────────────────────────────────────────────────────────────────

  describe('determineSeverity — direct unit tests', () => {
    it('should return OK for utilization = 0', () => {
      expect(service.determineSeverity(0)).toBe('OK');
    });

    it('should return OK for utilization = 50', () => {
      expect(service.determineSeverity(50)).toBe('OK');
    });

    it('should return OK for utilization = 90', () => {
      expect(service.determineSeverity(90)).toBe('OK');
    });

    it('should return ALERT for utilization = 90.01', () => {
      expect(service.determineSeverity(90.01)).toBe('ALERT');
    });

    it('should return ALERT for utilization = 92', () => {
      expect(service.determineSeverity(92)).toBe('ALERT');
    });

    it('should return ALERT for utilization = 95', () => {
      expect(service.determineSeverity(95)).toBe('ALERT');
    });

    it('should return CRITICAL for utilization = 95.01', () => {
      expect(service.determineSeverity(95.01)).toBe('CRITICAL');
    });

    it('should return CRITICAL for utilization = 100', () => {
      expect(service.determineSeverity(100)).toBe('CRITICAL');
    });

    it('should return CRITICAL for utilization = 120', () => {
      expect(service.determineSeverity(120)).toBe('CRITICAL');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Edge: volume does not go negative
  // ────────────────────────────────────────────────────────────────

  describe('Volume does not go negative', () => {
    it('should clamp projected volume to 0 when outgoing exceeds current stock', async () => {
      // Start: 10 units * 0.5 = 5 m3
      // Requirement: -100 units * 0.5 = -50 m3
      // Expected: max(0, 5 - 50) = 0 m3
      setupDepositos();
      setupInventory([
        {
          depositoId: 'dep-001',
          produtoId: 'prod-001',
          quantidadeDisponivel: mockDecimal(10),
        },
      ]);
      setupProductVolumes([{ id: 'prod-001', volumeM3: mockDecimal(0.5) }]);

      const result = await service.validateStorage(
        makeInput({
          grossRequirements: [
            {
              produtoId: 'prod-001',
              quantity: 100,
              date: new Date(Date.UTC(2026, 2, 4)),
            },
          ],
        }),
      );

      const week = result.depositos[0].weeklyResults[0];
      expect(week.projectedVolumeM3).toBe(0);
      expect(week.utilizationPercentual).toBe(0);
      expect(week.severity).toBe('OK');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Edge: product without volumeM3 is treated as 0
  // ────────────────────────────────────────────────────────────────

  describe('Product without volume — edge case', () => {
    it('should treat products without volumeM3 as 0 volume', async () => {
      setupDepositos();
      setupInventory([
        {
          depositoId: 'dep-001',
          produtoId: 'prod-no-vol',
          quantidadeDisponivel: mockDecimal(1000),
        },
      ]);
      // No product volume returned for this product
      mockPrismaService.produto.findMany.mockResolvedValue([]);

      const result = await service.validateStorage(makeInput());

      const week = result.depositos[0].weeklyResults[0];
      expect(week.projectedVolumeM3).toBe(0);
      expect(week.utilizationPercentual).toBe(0);
    });
  });
});
