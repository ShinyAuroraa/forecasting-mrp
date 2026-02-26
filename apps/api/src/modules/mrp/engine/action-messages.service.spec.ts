import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../prisma/prisma.service';
import { ActionMessagesService } from './action-messages.service';
import { ActionMessageType } from './interfaces/action-messages.interface';
import type {
  ActionMessagesInput,
  PlannedOrderRef,
} from './interfaces/action-messages.interface';

/**
 * Unit tests for ActionMessagesService — Action Message Generation Engine
 *
 * Test cases cover all 10 ACs from Story 3.8:
 *   1.  CANCEL: existing FIRME order, no planned requirement (AC-2)
 *   2.  INCREASE: existing qty=50 < planned qty=100 (AC-3)
 *   3.  REDUCE: existing qty=100 > planned qty=70 (AC-4)
 *   4.  EXPEDITE: existing delivery later than planned need (AC-5)
 *   5.  NEW: planned order with no existing counterpart (AC-6)
 *   6.  No changes: existing matches planned exactly (AC-1)
 *   7.  Multiple existing orders same product/period: aggregated comparison (AC-1)
 *   8.  Mixed: same product has INCREASE in one period, REDUCE in another (AC-1)
 *   9.  FIRME/LIBERADA compared, PLANEJADA ignored (AC-9)
 *   10. Combined qty + date change: EXPEDITE takes priority (AC-5)
 *   11. Empty planned orders: all existing get CANCEL (AC-2)
 *   12. Empty existing orders: all planned get NEW (AC-6)
 *   13. mensagemAcao persisted on OrdemPlanejada records (AC-7)
 *   14. Messages include delta qty and date change (AC-8)
 *
 * @see Story 3.8 — Action Messages
 * @see FR-039 — Action Messages
 */
describe('ActionMessagesService', () => {
  let service: ActionMessagesService;

  // ────────────────────────────────────────────────────────────────
  // Mock Setup
  // ────────────────────────────────────────────────────────────────

  const mockPrismaService = {
    ordemPlanejada: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionMessagesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ActionMessagesService>(ActionMessagesService);

    // Default: update resolves successfully
    mockPrismaService.ordemPlanejada.update.mockResolvedValue({});
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

  /** Create a UTC date from year, month (1-based), day */
  const utcDate = (year: number, month: number, day: number): Date =>
    new Date(Date.UTC(year, month - 1, day));

  /** Create an existing order record as returned by Prisma */
  const makeExistingOrder = (overrides?: {
    id?: string;
    produtoId?: string;
    tipo?: 'COMPRA' | 'PRODUCAO';
    quantidade?: ReturnType<typeof mockDecimal> | number;
    dataNecessidade?: Date;
    dataRecebimentoEsperado?: Date | null;
    status?: string;
  }) => ({
    id: overrides?.id ?? 'existing-001',
    produtoId: overrides?.produtoId ?? 'prod-001',
    tipo: overrides?.tipo ?? 'COMPRA',
    quantidade: overrides?.quantidade ?? mockDecimal(100),
    dataNecessidade: overrides?.dataNecessidade ?? utcDate(2026, 4, 1),
    dataRecebimentoEsperado:
      overrides !== undefined && 'dataRecebimentoEsperado' in overrides
        ? overrides.dataRecebimentoEsperado
        : utcDate(2026, 4, 1),
    status: overrides?.status ?? 'FIRME',
  });

  /** Create a planned order reference */
  const makePlannedOrder = (
    overrides?: Partial<PlannedOrderRef>,
  ): PlannedOrderRef => ({
    id: overrides?.id ?? 'planned-001',
    produtoId: overrides?.produtoId ?? 'prod-001',
    tipo: overrides?.tipo ?? 'COMPRA',
    quantidade: overrides?.quantidade ?? 100,
    dataNecessidade: overrides?.dataNecessidade ?? utcDate(2026, 4, 1),
  });

  /** Create a full ActionMessagesInput */
  const makeInput = (
    overrides?: Partial<ActionMessagesInput>,
  ): ActionMessagesInput => ({
    execucaoId: overrides?.execucaoId ?? 'exec-001',
    plannedOrders: overrides?.plannedOrders ?? [makePlannedOrder()],
  });

  /** Setup existing orders returned by findMany */
  const setupExistingOrders = (
    orders: ReturnType<typeof makeExistingOrder>[],
  ) => {
    mockPrismaService.ordemPlanejada.findMany.mockResolvedValue(orders);
  };

  // ────────────────────────────────────────────────────────────────
  // Test 1: CANCEL — existing FIRME order, no planned requirement (AC-2)
  // ────────────────────────────────────────────────────────────────

  describe('CANCEL — existing order, no planned requirement — AC-2', () => {
    it('should generate CANCEL when existing FIRME order has no corresponding planned order', async () => {
      setupExistingOrders([
        makeExistingOrder({
          id: 'existing-firme-001',
          produtoId: 'prod-A',
          tipo: 'COMPRA',
          status: 'FIRME',
          dataNecessidade: utcDate(2026, 4, 1),
        }),
      ]);

      const input = makeInput({
        // No planned orders for prod-A COMPRA
        plannedOrders: [],
      });

      const result = await service.generateActionMessages(input);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe(ActionMessageType.CANCEL);
      expect(result.messages[0].existingOrderId).toBe('existing-firme-001');
      expect(result.messages[0].plannedOrderId).toBeNull();
      expect(result.messages[0].message).toBe(
        'CANCEL: No requirement for 2026-04-01',
      );
      expect(result.totalCancel).toBe(1);
    });

    it('should generate CANCEL for LIBERADA order with no planned requirement', async () => {
      setupExistingOrders([
        makeExistingOrder({
          id: 'existing-lib-001',
          produtoId: 'prod-B',
          tipo: 'PRODUCAO',
          status: 'LIBERADA',
          dataNecessidade: utcDate(2026, 5, 15),
        }),
      ]);

      const input = makeInput({ plannedOrders: [] });

      const result = await service.generateActionMessages(input);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe(ActionMessageType.CANCEL);
      expect(result.messages[0].message).toContain('2026-05-15');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 2: INCREASE — existing qty < planned qty (AC-3)
  // ────────────────────────────────────────────────────────────────

  describe('INCREASE — existing qty < planned qty — AC-3', () => {
    it('should generate INCREASE when existing qty=50 < planned qty=100', async () => {
      setupExistingOrders([
        makeExistingOrder({
          id: 'existing-inc-001',
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(50),
          dataNecessidade: utcDate(2026, 4, 1),
          dataRecebimentoEsperado: utcDate(2026, 4, 1),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            id: 'planned-inc-001',
            produtoId: 'prod-001',
            tipo: 'COMPRA',
            quantidade: 100,
            dataNecessidade: utcDate(2026, 4, 1),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe(ActionMessageType.INCREASE);
      expect(result.messages[0].deltaQuantity).toBe(50);
      expect(result.messages[0].message).toBe('INCREASE: +50 units needed');
      expect(result.messages[0].existingOrderId).toBe('existing-inc-001');
      expect(result.messages[0].plannedOrderId).toBe('planned-inc-001');
      expect(result.totalIncrease).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 3: REDUCE — existing qty > planned qty (AC-4)
  // ────────────────────────────────────────────────────────────────

  describe('REDUCE — existing qty > planned qty — AC-4', () => {
    it('should generate REDUCE when existing qty=100 > planned qty=70', async () => {
      setupExistingOrders([
        makeExistingOrder({
          id: 'existing-red-001',
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(100),
          dataNecessidade: utcDate(2026, 4, 1),
          dataRecebimentoEsperado: utcDate(2026, 4, 1),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            id: 'planned-red-001',
            produtoId: 'prod-001',
            tipo: 'COMPRA',
            quantidade: 70,
            dataNecessidade: utcDate(2026, 4, 1),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe(ActionMessageType.REDUCE);
      expect(result.messages[0].deltaQuantity).toBe(30);
      expect(result.messages[0].message).toBe('REDUCE: -30 units excess');
      expect(result.totalReduce).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 4: EXPEDITE — delivery date later than need date (AC-5)
  // ────────────────────────────────────────────────────────────────

  describe('EXPEDITE — delivery date later than need date — AC-5', () => {
    it('should generate EXPEDITE when existing delivery 2026-04-01 > planned need 2026-03-25', async () => {
      setupExistingOrders([
        makeExistingOrder({
          id: 'existing-exp-001',
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(100),
          dataNecessidade: utcDate(2026, 3, 25),
          dataRecebimentoEsperado: utcDate(2026, 4, 1),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            id: 'planned-exp-001',
            produtoId: 'prod-001',
            tipo: 'COMPRA',
            quantidade: 100,
            dataNecessidade: utcDate(2026, 3, 25),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe(ActionMessageType.EXPEDITE);
      expect(result.messages[0].deltaDays).toBe(7);
      expect(result.messages[0].message).toBe(
        'EXPEDITE: Move forward 7 days',
      );
      expect(result.messages[0].currentDate).toEqual(utcDate(2026, 4, 1));
      expect(result.messages[0].requiredDate).toEqual(utcDate(2026, 3, 25));
      expect(result.totalExpedite).toBe(1);
    });

    it('should NOT generate EXPEDITE when delivery is on or before need date', async () => {
      setupExistingOrders([
        makeExistingOrder({
          id: 'existing-no-exp-001',
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(100),
          dataNecessidade: utcDate(2026, 4, 1),
          dataRecebimentoEsperado: utcDate(2026, 3, 25),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            id: 'planned-no-exp-001',
            produtoId: 'prod-001',
            tipo: 'COMPRA',
            quantidade: 100,
            dataNecessidade: utcDate(2026, 4, 1),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      // No messages — quantities match and delivery is on time
      expect(result.messages).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 5: NEW — planned order with no existing counterpart (AC-6)
  // ────────────────────────────────────────────────────────────────

  describe('NEW — planned order, no existing — AC-6', () => {
    it('should generate NEW when no existing orders match the product/type', async () => {
      // No existing orders
      setupExistingOrders([]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            id: 'planned-new-001',
            produtoId: 'prod-new',
            tipo: 'COMPRA',
            quantidade: 200,
            dataNecessidade: utcDate(2026, 4, 10),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe(ActionMessageType.NEW);
      expect(result.messages[0].existingOrderId).toBeNull();
      expect(result.messages[0].plannedOrderId).toBe('planned-new-001');
      expect(result.messages[0].message).toBe(
        'NEW: 200 units needed by 2026-04-10',
      );
      expect(result.totalNew).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 6: No changes — quantities match exactly (AC-1)
  // ────────────────────────────────────────────────────────────────

  describe('No changes — existing matches planned exactly — AC-1', () => {
    it('should generate no action message when quantities and dates match', async () => {
      setupExistingOrders([
        makeExistingOrder({
          id: 'existing-match-001',
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(100),
          dataNecessidade: utcDate(2026, 4, 1),
          dataRecebimentoEsperado: utcDate(2026, 4, 1),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            id: 'planned-match-001',
            produtoId: 'prod-001',
            tipo: 'COMPRA',
            quantidade: 100,
            dataNecessidade: utcDate(2026, 4, 1),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      expect(result.messages).toHaveLength(0);
      expect(result.totalCancel).toBe(0);
      expect(result.totalIncrease).toBe(0);
      expect(result.totalReduce).toBe(0);
      expect(result.totalExpedite).toBe(0);
      expect(result.totalNew).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 7: Multiple existing orders — aggregated comparison (AC-1)
  // ────────────────────────────────────────────────────────────────

  describe('Multiple existing orders same product/period — aggregated — AC-1', () => {
    it('should aggregate existing quantities when multiple match same planned period', async () => {
      // Two existing orders totaling 80 units for the same product/period
      setupExistingOrders([
        makeExistingOrder({
          id: 'existing-agg-001',
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(50),
          dataNecessidade: utcDate(2026, 4, 1),
          dataRecebimentoEsperado: utcDate(2026, 4, 1),
        }),
        makeExistingOrder({
          id: 'existing-agg-002',
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(30),
          dataNecessidade: utcDate(2026, 4, 2), // Within ±3 days tolerance
          dataRecebimentoEsperado: utcDate(2026, 4, 2),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            id: 'planned-agg-001',
            produtoId: 'prod-001',
            tipo: 'COMPRA',
            quantidade: 100,
            dataNecessidade: utcDate(2026, 4, 1),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      // Aggregated existing = 80, planned = 100 → INCREASE +20
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe(ActionMessageType.INCREASE);
      expect(result.messages[0].deltaQuantity).toBe(20);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 8: Mixed — INCREASE in one period, REDUCE in another (AC-1)
  // ────────────────────────────────────────────────────────────────

  describe('Mixed — different actions in different periods — AC-1', () => {
    it('should generate INCREASE for one period and REDUCE for another', async () => {
      setupExistingOrders([
        makeExistingOrder({
          id: 'existing-mix-001',
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(50),
          dataNecessidade: utcDate(2026, 4, 1),
          dataRecebimentoEsperado: utcDate(2026, 4, 1),
        }),
        makeExistingOrder({
          id: 'existing-mix-002',
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(200),
          dataNecessidade: utcDate(2026, 4, 15),
          dataRecebimentoEsperado: utcDate(2026, 4, 15),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            id: 'planned-mix-001',
            produtoId: 'prod-001',
            tipo: 'COMPRA',
            quantidade: 100,
            dataNecessidade: utcDate(2026, 4, 1),
          }),
          makePlannedOrder({
            id: 'planned-mix-002',
            produtoId: 'prod-001',
            tipo: 'COMPRA',
            quantidade: 150,
            dataNecessidade: utcDate(2026, 4, 15),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      expect(result.messages).toHaveLength(2);

      const increaseMsg = result.messages.find(
        (m) => m.type === ActionMessageType.INCREASE,
      );
      const reduceMsg = result.messages.find(
        (m) => m.type === ActionMessageType.REDUCE,
      );

      expect(increaseMsg).toBeDefined();
      expect(increaseMsg!.deltaQuantity).toBe(50); // 100 - 50
      expect(reduceMsg).toBeDefined();
      expect(reduceMsg!.deltaQuantity).toBe(50); // 200 - 150
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 9: FIRME/LIBERADA compared, PLANEJADA ignored (AC-9)
  // ────────────────────────────────────────────────────────────────

  describe('FIRME/LIBERADA compared, PLANEJADA ignored — AC-9', () => {
    it('should query only FIRME and LIBERADA orders from the database', async () => {
      setupExistingOrders([]);

      const input = makeInput({ plannedOrders: [] });

      await service.generateActionMessages(input);

      expect(mockPrismaService.ordemPlanejada.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['FIRME', 'LIBERADA'] },
        },
        select: {
          id: true,
          produtoId: true,
          tipo: true,
          quantidade: true,
          dataNecessidade: true,
          dataRecebimentoEsperado: true,
          status: true,
        },
      });
    });

    it('should only process FIRME/LIBERADA records returned by Prisma', async () => {
      // Simulate that only FIRME/LIBERADA are returned (Prisma filters PLANEJADA/CANCELADA)
      setupExistingOrders([
        makeExistingOrder({
          id: 'firme-only',
          produtoId: 'prod-filter',
          tipo: 'COMPRA',
          status: 'FIRME',
          quantidade: mockDecimal(100),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [], // No planned → should CANCEL the FIRME one
      });

      const result = await service.generateActionMessages(input);

      // Only the FIRME order generates a CANCEL
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe(ActionMessageType.CANCEL);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 10: Combined qty + date change — EXPEDITE takes priority (AC-5)
  // ────────────────────────────────────────────────────────────────

  describe('Combined qty + date change — EXPEDITE takes priority — AC-5', () => {
    it('should generate EXPEDITE instead of INCREASE when both qty and date differ', async () => {
      setupExistingOrders([
        makeExistingOrder({
          id: 'existing-combo-001',
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(50),
          dataNecessidade: utcDate(2026, 3, 25),
          dataRecebimentoEsperado: utcDate(2026, 4, 5), // Late delivery
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            id: 'planned-combo-001',
            produtoId: 'prod-001',
            tipo: 'COMPRA',
            quantidade: 100, // qty also differs
            dataNecessidade: utcDate(2026, 3, 25),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      // EXPEDITE takes priority over INCREASE
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe(ActionMessageType.EXPEDITE);
      expect(result.messages[0].deltaDays).toBe(11); // Apr 5 → Mar 25 = 11 days
      expect(result.totalExpedite).toBe(1);
      expect(result.totalIncrease).toBe(0);
    });

    it('should generate EXPEDITE instead of REDUCE when both qty and date differ', async () => {
      setupExistingOrders([
        makeExistingOrder({
          id: 'existing-combo-002',
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(200),
          dataNecessidade: utcDate(2026, 3, 25),
          dataRecebimentoEsperado: utcDate(2026, 4, 1), // Late delivery
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            id: 'planned-combo-002',
            produtoId: 'prod-001',
            tipo: 'COMPRA',
            quantidade: 100, // qty also lower
            dataNecessidade: utcDate(2026, 3, 25),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe(ActionMessageType.EXPEDITE);
      expect(result.totalReduce).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 11: Empty planned orders — all existing get CANCEL (AC-2)
  // ────────────────────────────────────────────────────────────────

  describe('Empty planned orders — all existing get CANCEL — AC-2', () => {
    it('should CANCEL all existing orders when planned orders list is empty', async () => {
      setupExistingOrders([
        makeExistingOrder({
          id: 'existing-empty-001',
          produtoId: 'prod-A',
          tipo: 'COMPRA',
        }),
        makeExistingOrder({
          id: 'existing-empty-002',
          produtoId: 'prod-B',
          tipo: 'PRODUCAO',
        }),
      ]);

      const input = makeInput({ plannedOrders: [] });

      const result = await service.generateActionMessages(input);

      expect(result.messages).toHaveLength(2);
      expect(result.messages.every((m) => m.type === ActionMessageType.CANCEL)).toBe(
        true,
      );
      expect(result.totalCancel).toBe(2);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 12: Empty existing orders — all planned get NEW (AC-6)
  // ────────────────────────────────────────────────────────────────

  describe('Empty existing orders — all planned get NEW — AC-6', () => {
    it('should generate NEW for all planned orders when no existing orders exist', async () => {
      setupExistingOrders([]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            id: 'planned-all-new-001',
            produtoId: 'prod-X',
            tipo: 'COMPRA',
            quantidade: 100,
            dataNecessidade: utcDate(2026, 4, 1),
          }),
          makePlannedOrder({
            id: 'planned-all-new-002',
            produtoId: 'prod-Y',
            tipo: 'PRODUCAO',
            quantidade: 50,
            dataNecessidade: utcDate(2026, 4, 15),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      expect(result.messages).toHaveLength(2);
      expect(result.messages.every((m) => m.type === ActionMessageType.NEW)).toBe(
        true,
      );
      expect(result.totalNew).toBe(2);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 13: mensagemAcao persisted on OrdemPlanejada records (AC-7)
  // ────────────────────────────────────────────────────────────────

  describe('mensagemAcao persistence — AC-7', () => {
    it('should update mensagemAcao on planned order for NEW message', async () => {
      setupExistingOrders([]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            id: 'planned-persist-001',
            produtoId: 'prod-P',
            tipo: 'COMPRA',
            quantidade: 75,
            dataNecessidade: utcDate(2026, 5, 1),
          }),
        ],
      });

      await service.generateActionMessages(input);

      expect(mockPrismaService.ordemPlanejada.update).toHaveBeenCalledWith({
        where: { id: 'planned-persist-001' },
        data: { mensagemAcao: 'NEW: 75 units needed by 2026-05-01' },
      });
    });

    it('should update mensagemAcao on existing order for CANCEL message', async () => {
      setupExistingOrders([
        makeExistingOrder({
          id: 'existing-persist-cancel',
          produtoId: 'prod-C',
          tipo: 'COMPRA',
          dataNecessidade: utcDate(2026, 6, 1),
        }),
      ]);

      const input = makeInput({ plannedOrders: [] });

      await service.generateActionMessages(input);

      expect(mockPrismaService.ordemPlanejada.update).toHaveBeenCalledWith({
        where: { id: 'existing-persist-cancel' },
        data: { mensagemAcao: 'CANCEL: No requirement for 2026-06-01' },
      });
    });

    it('should update mensagemAcao on planned order for INCREASE message', async () => {
      setupExistingOrders([
        makeExistingOrder({
          id: 'existing-persist-inc',
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(40),
          dataNecessidade: utcDate(2026, 4, 1),
          dataRecebimentoEsperado: utcDate(2026, 4, 1),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            id: 'planned-persist-inc',
            produtoId: 'prod-001',
            tipo: 'COMPRA',
            quantidade: 90,
            dataNecessidade: utcDate(2026, 4, 1),
          }),
        ],
      });

      await service.generateActionMessages(input);

      expect(mockPrismaService.ordemPlanejada.update).toHaveBeenCalledWith({
        where: { id: 'planned-persist-inc' },
        data: { mensagemAcao: 'INCREASE: +50 units needed' },
      });
    });

    it('should not call update when no messages are generated', async () => {
      setupExistingOrders([
        makeExistingOrder({
          id: 'existing-no-update',
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(100),
          dataNecessidade: utcDate(2026, 4, 1),
          dataRecebimentoEsperado: utcDate(2026, 4, 1),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            produtoId: 'prod-001',
            tipo: 'COMPRA',
            quantidade: 100,
            dataNecessidade: utcDate(2026, 4, 1),
          }),
        ],
      });

      await service.generateActionMessages(input);

      expect(mockPrismaService.ordemPlanejada.update).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 14: Messages include delta qty and date change (AC-8)
  // ────────────────────────────────────────────────────────────────

  describe('Messages include delta qty and date change — AC-8', () => {
    it('should include deltaQuantity in INCREASE message', async () => {
      setupExistingOrders([
        makeExistingOrder({
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(60),
          dataNecessidade: utcDate(2026, 4, 1),
          dataRecebimentoEsperado: utcDate(2026, 4, 1),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            produtoId: 'prod-001',
            tipo: 'COMPRA',
            quantidade: 85,
            dataNecessidade: utcDate(2026, 4, 1),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      expect(result.messages[0].deltaQuantity).toBe(25);
      expect(result.messages[0].deltaDays).toBeNull();
    });

    it('should include deltaQuantity in REDUCE message', async () => {
      setupExistingOrders([
        makeExistingOrder({
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(150),
          dataNecessidade: utcDate(2026, 4, 1),
          dataRecebimentoEsperado: utcDate(2026, 4, 1),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            produtoId: 'prod-001',
            tipo: 'COMPRA',
            quantidade: 120,
            dataNecessidade: utcDate(2026, 4, 1),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      expect(result.messages[0].deltaQuantity).toBe(30);
      expect(result.messages[0].deltaDays).toBeNull();
    });

    it('should include deltaDays in EXPEDITE message', async () => {
      setupExistingOrders([
        makeExistingOrder({
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(100),
          dataNecessidade: utcDate(2026, 3, 20),
          dataRecebimentoEsperado: utcDate(2026, 4, 10),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            produtoId: 'prod-001',
            tipo: 'COMPRA',
            quantidade: 100,
            dataNecessidade: utcDate(2026, 3, 20),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      expect(result.messages[0].deltaDays).toBe(21); // Apr 10 → Mar 20
      expect(result.messages[0].deltaQuantity).toBeNull();
    });

    it('should include null deltas in CANCEL and NEW messages', async () => {
      setupExistingOrders([
        makeExistingOrder({
          id: 'cancel-delta',
          produtoId: 'prod-A',
          tipo: 'COMPRA',
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            id: 'new-delta',
            produtoId: 'prod-B',
            tipo: 'PRODUCAO',
            quantidade: 100,
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      const cancelMsg = result.messages.find(
        (m) => m.type === ActionMessageType.CANCEL,
      );
      const newMsg = result.messages.find(
        (m) => m.type === ActionMessageType.NEW,
      );

      expect(cancelMsg!.deltaQuantity).toBeNull();
      expect(cancelMsg!.deltaDays).toBeNull();
      expect(newMsg!.deltaQuantity).toBeNull();
      expect(newMsg!.deltaDays).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Period tolerance matching
  // ────────────────────────────────────────────────────────────────

  describe('Period tolerance matching', () => {
    it('should match existing and planned orders within ±3 days', async () => {
      setupExistingOrders([
        makeExistingOrder({
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(100),
          dataNecessidade: utcDate(2026, 4, 3), // 2 days after planned
          dataRecebimentoEsperado: utcDate(2026, 3, 30), // Delivery on or before planned need
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            produtoId: 'prod-001',
            tipo: 'COMPRA',
            quantidade: 100,
            dataNecessidade: utcDate(2026, 4, 1),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      // Should match within tolerance → quantities equal, delivery on time → no message
      expect(result.messages).toHaveLength(0);
    });

    it('should NOT match orders beyond ±3 days tolerance', async () => {
      setupExistingOrders([
        makeExistingOrder({
          id: 'existing-far',
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(100),
          dataNecessidade: utcDate(2026, 4, 10), // 9 days after planned → out of range
          dataRecebimentoEsperado: utcDate(2026, 4, 10),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            id: 'planned-far',
            produtoId: 'prod-001',
            tipo: 'COMPRA',
            quantidade: 100,
            dataNecessidade: utcDate(2026, 4, 1),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      // Should NOT match → existing gets CANCEL, planned gets NEW
      expect(result.messages).toHaveLength(2);

      const cancelMsg = result.messages.find(
        (m) => m.type === ActionMessageType.CANCEL,
      );
      const newMsg = result.messages.find(
        (m) => m.type === ActionMessageType.NEW,
      );

      expect(cancelMsg).toBeDefined();
      expect(cancelMsg!.existingOrderId).toBe('existing-far');
      expect(newMsg).toBeDefined();
      expect(newMsg!.plannedOrderId).toBe('planned-far');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Product/Type isolation
  // ────────────────────────────────────────────────────────────────

  describe('Product/Type isolation', () => {
    it('should NOT match orders with same product but different tipo', async () => {
      setupExistingOrders([
        makeExistingOrder({
          id: 'existing-compra',
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(100),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            id: 'planned-producao',
            produtoId: 'prod-001',
            tipo: 'PRODUCAO', // Different tipo
            quantidade: 100,
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      // COMPRA gets CANCEL, PRODUCAO gets NEW
      expect(result.messages).toHaveLength(2);
      expect(result.totalCancel).toBe(1);
      expect(result.totalNew).toBe(1);
    });

    it('should NOT match orders with same tipo but different product', async () => {
      setupExistingOrders([
        makeExistingOrder({
          id: 'existing-prodA',
          produtoId: 'prod-A',
          tipo: 'COMPRA',
          quantidade: mockDecimal(100),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            id: 'planned-prodB',
            produtoId: 'prod-B', // Different product
            tipo: 'COMPRA',
            quantidade: 100,
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      expect(result.messages).toHaveLength(2);
      expect(result.totalCancel).toBe(1);
      expect(result.totalNew).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Output structure
  // ────────────────────────────────────────────────────────────────

  describe('Output structure', () => {
    it('should return execucaoId in the output', async () => {
      setupExistingOrders([]);

      const input = makeInput({
        execucaoId: 'exec-output-test',
        plannedOrders: [],
      });

      const result = await service.generateActionMessages(input);

      expect(result.execucaoId).toBe('exec-output-test');
    });

    it('should return correct summary counts for mixed messages', async () => {
      setupExistingOrders([
        // CANCEL: no planned for prod-C
        makeExistingOrder({
          id: 'ex-cancel',
          produtoId: 'prod-C',
          tipo: 'COMPRA',
          quantidade: mockDecimal(100),
        }),
        // INCREASE: existing 50 < planned 100
        makeExistingOrder({
          id: 'ex-increase',
          produtoId: 'prod-D',
          tipo: 'COMPRA',
          quantidade: mockDecimal(50),
          dataNecessidade: utcDate(2026, 4, 1),
          dataRecebimentoEsperado: utcDate(2026, 4, 1),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          // INCREASE for prod-D
          makePlannedOrder({
            id: 'pl-increase',
            produtoId: 'prod-D',
            tipo: 'COMPRA',
            quantidade: 100,
            dataNecessidade: utcDate(2026, 4, 1),
          }),
          // NEW for prod-E
          makePlannedOrder({
            id: 'pl-new',
            produtoId: 'prod-E',
            tipo: 'PRODUCAO',
            quantidade: 75,
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      expect(result.totalCancel).toBe(1);
      expect(result.totalIncrease).toBe(1);
      expect(result.totalNew).toBe(1);
      expect(result.totalReduce).toBe(0);
      expect(result.totalExpedite).toBe(0);
      expect(result.messages).toHaveLength(3);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Message format — VarChar(100) compliance
  // ────────────────────────────────────────────────────────────────

  describe('Message format — VarChar(100) compliance', () => {
    it('should generate CANCEL message <= 100 characters', async () => {
      setupExistingOrders([
        makeExistingOrder({
          produtoId: 'prod-001',
          dataNecessidade: utcDate(2026, 12, 31),
        }),
      ]);

      const input = makeInput({ plannedOrders: [] });

      const result = await service.generateActionMessages(input);

      expect(result.messages[0].message.length).toBeLessThanOrEqual(100);
    });

    it('should generate INCREASE message <= 100 characters', async () => {
      setupExistingOrders([
        makeExistingOrder({
          produtoId: 'prod-001',
          quantidade: mockDecimal(1),
          dataNecessidade: utcDate(2026, 4, 1),
          dataRecebimentoEsperado: utcDate(2026, 4, 1),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            produtoId: 'prod-001',
            quantidade: 999999999,
            dataNecessidade: utcDate(2026, 4, 1),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      expect(result.messages[0].message.length).toBeLessThanOrEqual(100);
    });

    it('should generate NEW message <= 100 characters', async () => {
      setupExistingOrders([]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            produtoId: 'prod-001',
            quantidade: 999999999,
            dataNecessidade: utcDate(2026, 12, 31),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      expect(result.messages[0].message.length).toBeLessThanOrEqual(100);
    });

    it('should generate EXPEDITE message <= 100 characters', async () => {
      setupExistingOrders([
        makeExistingOrder({
          produtoId: 'prod-001',
          quantidade: mockDecimal(100),
          dataNecessidade: utcDate(2026, 3, 1),
          dataRecebimentoEsperado: utcDate(2026, 12, 31),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            produtoId: 'prod-001',
            quantidade: 100,
            dataNecessidade: utcDate(2026, 3, 1),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      expect(result.messages[0].message.length).toBeLessThanOrEqual(100);
    });

    it('should generate REDUCE message <= 100 characters', async () => {
      setupExistingOrders([
        makeExistingOrder({
          produtoId: 'prod-001',
          quantidade: mockDecimal(999999999),
          dataNecessidade: utcDate(2026, 4, 1),
          dataRecebimentoEsperado: utcDate(2026, 4, 1),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            produtoId: 'prod-001',
            quantidade: 1,
            dataNecessidade: utcDate(2026, 4, 1),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      expect(result.messages[0].message.length).toBeLessThanOrEqual(100);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Decimal handling
  // ────────────────────────────────────────────────────────────────

  describe('Decimal handling', () => {
    it('should correctly convert Prisma Decimal quantities to numbers', async () => {
      setupExistingOrders([
        makeExistingOrder({
          produtoId: 'prod-001',
          tipo: 'COMPRA',
          quantidade: mockDecimal(75.5),
          dataNecessidade: utcDate(2026, 4, 1),
          dataRecebimentoEsperado: utcDate(2026, 4, 1),
        }),
      ]);

      const input = makeInput({
        plannedOrders: [
          makePlannedOrder({
            produtoId: 'prod-001',
            tipo: 'COMPRA',
            quantidade: 100.25,
            dataNecessidade: utcDate(2026, 4, 1),
          }),
        ],
      });

      const result = await service.generateActionMessages(input);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe(ActionMessageType.INCREASE);
      expect(result.messages[0].deltaQuantity).toBe(24.75);
    });
  });
});
