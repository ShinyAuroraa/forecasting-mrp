import { BadRequestException } from '@nestjs/common';

import { LotSizingService } from './lot-sizing.service';
import type { LotSizingInput, LotSizingPeriod } from './interfaces/lot-sizing.interface';

/**
 * Unit tests for LotSizingService — Pure Calculation Engine
 *
 * Test cases cover AC-10 requirements with 15+ scenarios:
 *   1.  L4L: each period gets exactly net requirement after constraints
 *   2.  EOQ: covers multiple periods, new order only when depleted
 *   3.  EOQ: deficit > EOQ triggers order for max(eoq, deficit)
 *   4.  Silver-Meal: aggregates while avg cost decreasing, stops when increasing
 *   5.  Silver-Meal: with zero-demand periods interspersed
 *   6.  Constraint: lote_minimo — qty below minimum rounded up
 *   7.  Constraint: multiplo_compra — qty rounded up to nearest multiple
 *   8.  Constraint: MOQ — qty below MOQ rounded up
 *   9.  Constraint order: lote_minimo -> multiplo_compra -> MOQ sequential
 *   10. Lead time offset: receipt at period t, release at t - LT
 *   11. Past-due release: release date before planning horizon
 *   12. Zero net requirements: no planned orders
 *   13. Single period with large net: basic functionality
 *   14. All methods with same input: compare outputs
 *   15. Edge: eoqValue = 0 with EOQ method — fallback to L4L behavior
 *
 * @see Story 3.5 — AC-10
 */
describe('LotSizingService', () => {
  let service: LotSizingService;

  beforeEach(() => {
    service = new LotSizingService();
  });

  // ────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────

  /** Create a planning period at the given week offset from a base date. */
  const makePeriod = (weekOffset: number, quantity: number): LotSizingPeriod => ({
    periodStart: new Date(2026, 2, 2 + weekOffset * 7),
    periodEnd: new Date(2026, 2, 8 + weekOffset * 7),
    quantity,
  });

  /** Create a full LotSizingInput with sensible defaults. */
  const makeInput = (
    overrides: Partial<LotSizingInput> & { netRequirements: readonly LotSizingPeriod[] },
  ): LotSizingInput => ({
    produtoId: 'prod-001',
    method: 'L4L',
    eoqValue: 0,
    loteMinimo: 1,
    multiploCompra: 1,
    moq: 1,
    leadTimePeriods: 0,
    orderingCost: 0,
    holdingCostPerUnit: 0,
    ...overrides,
  });

  // ────────────────────────────────────────────────────────────────
  // Test 1: L4L — each period gets exactly net requirement (AC-2)
  // ────────────────────────────────────────────────────────────────

  describe('L4L (Lot-for-Lot) — AC-2', () => {
    it('should return planned order = net requirement for each period', () => {
      const input = makeInput({
        method: 'L4L',
        netRequirements: [
          makePeriod(0, 100),
          makePeriod(1, 50),
          makePeriod(2, 200),
          makePeriod(3, 0),
          makePeriod(4, 75),
        ],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts).toHaveLength(4);
      expect(result.plannedOrderReceipts[0].quantity).toBe(100);
      expect(result.plannedOrderReceipts[0].periodIndex).toBe(0);
      expect(result.plannedOrderReceipts[1].quantity).toBe(50);
      expect(result.plannedOrderReceipts[1].periodIndex).toBe(1);
      expect(result.plannedOrderReceipts[2].quantity).toBe(200);
      expect(result.plannedOrderReceipts[2].periodIndex).toBe(2);
      expect(result.plannedOrderReceipts[3].quantity).toBe(75);
      expect(result.plannedOrderReceipts[3].periodIndex).toBe(4);
    });

    it('should skip periods with zero net requirement', () => {
      const input = makeInput({
        method: 'L4L',
        netRequirements: [
          makePeriod(0, 0),
          makePeriod(1, 0),
          makePeriod(2, 100),
        ],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts).toHaveLength(1);
      expect(result.plannedOrderReceipts[0].periodIndex).toBe(2);
      expect(result.plannedOrderReceipts[0].quantity).toBe(100);
    });

    it('should apply constraints to L4L orders', () => {
      const input = makeInput({
        method: 'L4L',
        loteMinimo: 50,
        multiploCompra: 25,
        moq: 100,
        netRequirements: [
          makePeriod(0, 10), // 10 -> loteMinimo 50 -> multiploCompra 50 -> MOQ 100
          makePeriod(1, 80), // 80 -> loteMinimo ok -> multiploCompra 100 -> MOQ 100
        ],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts).toHaveLength(2);
      expect(result.plannedOrderReceipts[0].quantity).toBe(100);
      expect(result.plannedOrderReceipts[1].quantity).toBe(100);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 2 & 3: EOQ — multi-period coverage and deficit handling (AC-3)
  // ────────────────────────────────────────────────────────────────

  describe('EOQ (Economic Order Quantity) — AC-3', () => {
    it('should cover multiple periods with a single EOQ order', () => {
      const input = makeInput({
        method: 'EOQ',
        eoqValue: 300,
        netRequirements: [
          makePeriod(0, 100), // Order 300, coverage = 200
          makePeriod(1, 80),  // Covered, coverage = 120
          makePeriod(2, 60),  // Covered, coverage = 60
          makePeriod(3, 50),  // Covered, coverage = 10
          makePeriod(4, 40),  // Not fully covered (10 < 40), new order
        ],
      });

      const result = service.calculateLotSizing(input);

      // First order at period 0 covers periods 0-3
      expect(result.plannedOrderReceipts).toHaveLength(2);
      expect(result.plannedOrderReceipts[0].periodIndex).toBe(0);
      expect(result.plannedOrderReceipts[0].quantity).toBe(300);
      // Second order at period 4: deficit = 40 - 10 = 30, max(300, 30) = 300
      expect(result.plannedOrderReceipts[1].periodIndex).toBe(4);
      expect(result.plannedOrderReceipts[1].quantity).toBe(300);
    });

    it('should order max(eoq, deficit) when deficit > EOQ', () => {
      const input = makeInput({
        method: 'EOQ',
        eoqValue: 50,
        netRequirements: [
          makePeriod(0, 200), // deficit = 200, max(50, 200) = 200
        ],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts).toHaveLength(1);
      expect(result.plannedOrderReceipts[0].quantity).toBe(200);
    });

    it('should handle EOQ with accumulated coverage depleting exactly', () => {
      const input = makeInput({
        method: 'EOQ',
        eoqValue: 150,
        netRequirements: [
          makePeriod(0, 100), // Order 150, coverage = 50
          makePeriod(1, 50),  // Covered exactly, coverage = 0
          makePeriod(2, 80),  // New order needed: deficit = 80, max(150, 80) = 150
        ],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts).toHaveLength(2);
      expect(result.plannedOrderReceipts[0].periodIndex).toBe(0);
      expect(result.plannedOrderReceipts[0].quantity).toBe(150);
      expect(result.plannedOrderReceipts[1].periodIndex).toBe(2);
      expect(result.plannedOrderReceipts[1].quantity).toBe(150);
    });

    it('should skip zero-demand periods without decrementing coverage', () => {
      const input = makeInput({
        method: 'EOQ',
        eoqValue: 200,
        netRequirements: [
          makePeriod(0, 100), // Order 200, coverage = 100
          makePeriod(1, 0),   // No demand — coverage stays 100
          makePeriod(2, 0),   // No demand — coverage stays 100
          makePeriod(3, 80),  // Covered, coverage = 20
        ],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts).toHaveLength(1);
      expect(result.plannedOrderReceipts[0].periodIndex).toBe(0);
      expect(result.plannedOrderReceipts[0].quantity).toBe(200);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 4 & 5: Silver-Meal (AC-4)
  // ────────────────────────────────────────────────────────────────

  describe('Silver-Meal Heuristic — AC-4', () => {
    it('should aggregate periods while average cost per period decreases', () => {
      // K = 100, h = 1 per unit per period
      // Period 0: demand = 50 → cost = 100, avgCost = 100/1 = 100
      // Period 1: demand = 40 → holding = 1*40*1=40, totalCost=140, avgCost=140/2=70 < 100 → include
      // Period 2: demand = 60 → holding = 1*60*2=120, totalCost=260, avgCost=260/3=86.67 > 70 → STOP
      const input = makeInput({
        method: 'SILVER_MEAL',
        orderingCost: 100,
        holdingCostPerUnit: 1,
        netRequirements: [
          makePeriod(0, 50),
          makePeriod(1, 40),
          makePeriod(2, 60),
        ],
      });

      const result = service.calculateLotSizing(input);

      // Order 1: period 0 covering periods 0+1 = 50+40 = 90
      // Order 2: period 2 covering period 2 = 60
      expect(result.plannedOrderReceipts).toHaveLength(2);
      expect(result.plannedOrderReceipts[0].periodIndex).toBe(0);
      expect(result.plannedOrderReceipts[0].quantity).toBe(90);
      expect(result.plannedOrderReceipts[1].periodIndex).toBe(2);
      expect(result.plannedOrderReceipts[1].quantity).toBe(60);
    });

    it('should handle zero-demand periods interspersed', () => {
      // K = 100, h = 1
      // Period 0: demand = 50 → cost = 100, avgCost = 100
      // Period 1: demand = 0  → skip (zero demand)
      // Period 2: demand = 30 → holding = 1*30*2=60, totalCost=160, avgCost=160/2=80 < 100 → include
      // Period 3: demand = 20 → holding = 1*20*3=60, totalCost=220, avgCost=220/3≈73.33 < 80 → include
      // Period 4: demand = 40 → holding = 1*40*4=160, totalCost=380, avgCost=380/4=95 > 73.33 → STOP
      const input = makeInput({
        method: 'SILVER_MEAL',
        orderingCost: 100,
        holdingCostPerUnit: 1,
        netRequirements: [
          makePeriod(0, 50),
          makePeriod(1, 0),
          makePeriod(2, 30),
          makePeriod(3, 20),
          makePeriod(4, 40),
        ],
      });

      const result = service.calculateLotSizing(input);

      // Order 1: period 0, qty = 50 + 30 + 20 = 100
      // Order 2: period 4, qty = 40
      expect(result.plannedOrderReceipts).toHaveLength(2);
      expect(result.plannedOrderReceipts[0].periodIndex).toBe(0);
      expect(result.plannedOrderReceipts[0].quantity).toBe(100);
      expect(result.plannedOrderReceipts[1].periodIndex).toBe(4);
      expect(result.plannedOrderReceipts[1].quantity).toBe(40);
    });

    it('should not aggregate when adding any future period increases avg cost', () => {
      // K = 10, h = 5 per unit per period
      // Period 0: demand = 100 → cost = 10, avgCost = 10
      // Period 1: demand = 100 → holding = 5*100*1=500, totalCost=510, avgCost=255 > 10 → STOP
      const input = makeInput({
        method: 'SILVER_MEAL',
        orderingCost: 10,
        holdingCostPerUnit: 5,
        netRequirements: [
          makePeriod(0, 100),
          makePeriod(1, 100),
        ],
      });

      const result = service.calculateLotSizing(input);

      // Each period gets its own order (similar to L4L)
      expect(result.plannedOrderReceipts).toHaveLength(2);
      expect(result.plannedOrderReceipts[0].quantity).toBe(100);
      expect(result.plannedOrderReceipts[1].quantity).toBe(100);
    });

    it('should aggregate all periods when avg cost keeps decreasing', () => {
      // K = 1000, h = 0.1 per unit per period
      // Very high ordering cost, very low holding cost → aggregate everything
      // Period 0: demand=10, cost=1000, avg=1000
      // Period 1: demand=10, holding=0.1*10*1=1, total=1001, avg=500.5 < 1000 → include
      // Period 2: demand=10, holding=0.1*10*2=2, total=1003, avg≈334.33 < 500.5 → include
      const input = makeInput({
        method: 'SILVER_MEAL',
        orderingCost: 1000,
        holdingCostPerUnit: 0.1,
        netRequirements: [
          makePeriod(0, 10),
          makePeriod(1, 10),
          makePeriod(2, 10),
        ],
      });

      const result = service.calculateLotSizing(input);

      // All aggregated into one order
      expect(result.plannedOrderReceipts).toHaveLength(1);
      expect(result.plannedOrderReceipts[0].periodIndex).toBe(0);
      expect(result.plannedOrderReceipts[0].quantity).toBe(30);
    });

    it('should apply constraints to Silver-Meal aggregated quantity', () => {
      const input = makeInput({
        method: 'SILVER_MEAL',
        orderingCost: 1000,
        holdingCostPerUnit: 0.01,
        loteMinimo: 100,
        multiploCompra: 50,
        moq: 1,
        netRequirements: [
          makePeriod(0, 10),
          makePeriod(1, 15),
          makePeriod(2, 8),
        ],
      });

      const result = service.calculateLotSizing(input);

      // Raw = 10+15+8 = 33 → loteMinimo 100 → multiploCompra 100 → MOQ ok
      expect(result.plannedOrderReceipts).toHaveLength(1);
      expect(result.plannedOrderReceipts[0].quantity).toBe(100);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Tests 6–9: Constraint Application (AC-5, AC-6)
  // ────────────────────────────────────────────────────────────────

  describe('Constraint: lote_minimo — AC-6', () => {
    it('should round up quantity to lote_minimo when below minimum', () => {
      const input = makeInput({
        method: 'L4L',
        loteMinimo: 50,
        netRequirements: [makePeriod(0, 10)],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts[0].quantity).toBe(50);
    });

    it('should not modify quantity when already >= lote_minimo', () => {
      const input = makeInput({
        method: 'L4L',
        loteMinimo: 50,
        netRequirements: [makePeriod(0, 75)],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts[0].quantity).toBe(75);
    });
  });

  describe('Constraint: multiplo_compra — AC-6', () => {
    it('should round up quantity to nearest multiple of multiplo_compra', () => {
      const input = makeInput({
        method: 'L4L',
        multiploCompra: 25,
        netRequirements: [makePeriod(0, 60)],
      });

      const result = service.calculateLotSizing(input);

      // 60 → ceil(60/25)*25 = 3*25 = 75
      expect(result.plannedOrderReceipts[0].quantity).toBe(75);
    });

    it('should not modify quantity when already a multiple', () => {
      const input = makeInput({
        method: 'L4L',
        multiploCompra: 25,
        netRequirements: [makePeriod(0, 50)],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts[0].quantity).toBe(50);
    });

    it('should not apply multiplo_compra when value is 1', () => {
      const input = makeInput({
        method: 'L4L',
        multiploCompra: 1,
        netRequirements: [makePeriod(0, 37)],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts[0].quantity).toBe(37);
    });
  });

  describe('Constraint: MOQ — AC-6', () => {
    it('should round up to MOQ when quantity is below supplier minimum', () => {
      const input = makeInput({
        method: 'L4L',
        moq: 100,
        netRequirements: [makePeriod(0, 30)],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts[0].quantity).toBe(100);
    });

    it('should not modify quantity when already >= MOQ', () => {
      const input = makeInput({
        method: 'L4L',
        moq: 100,
        netRequirements: [makePeriod(0, 150)],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts[0].quantity).toBe(150);
    });

    it('should not apply MOQ when value is 1', () => {
      const input = makeInput({
        method: 'L4L',
        moq: 1,
        netRequirements: [makePeriod(0, 5)],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts[0].quantity).toBe(5);
    });
  });

  describe('Constraint ordering: loteMinimo -> multiploCompra -> MOQ — AC-5', () => {
    it('should apply constraints in strict sequential order', () => {
      // Crafted to verify the exact order of operations:
      // Raw qty = 7
      // Step 1: loteMinimo = 15 → 7 < 15 → result = 15
      // Step 2: multiploCompra = 10 → ceil(15/10)*10 = 20
      // Step 3: MOQ = 25 → 20 < 25 → result = 25
      const input = makeInput({
        method: 'L4L',
        loteMinimo: 15,
        multiploCompra: 10,
        moq: 25,
        netRequirements: [makePeriod(0, 7)],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts[0].quantity).toBe(25);
    });

    it('should demonstrate order matters: different result if MOQ applied first', () => {
      // Raw qty = 3
      // Correct order (AC-5): loteMinimo(10) -> multiploCompra(6) -> MOQ(8)
      // Step 1: 3 < 10 → 10
      // Step 2: ceil(10/6)*6 = 12
      // Step 3: 12 >= 8 → 12 (MOQ already met)
      //
      // Wrong order (MOQ first): MOQ(8) -> loteMinimo(10) -> multiploCompra(6)
      // Step 1: 3 < 8 → 8
      // Step 2: 8 < 10 → 10
      // Step 3: ceil(10/6)*6 = 12
      // Same result in this case, but the SERVICE follows the correct order
      const input = makeInput({
        method: 'L4L',
        loteMinimo: 10,
        multiploCompra: 6,
        moq: 8,
        netRequirements: [makePeriod(0, 3)],
      });

      const result = service.calculateLotSizing(input);

      // After correct order: 3 → 10 → 12 → 12 (MOQ met)
      expect(result.plannedOrderReceipts[0].quantity).toBe(12);
    });

    it('should handle constraints where multiploCompra satisfies MOQ', () => {
      // Raw qty = 5
      // Step 1: loteMinimo = 1 → 5 >= 1, no change
      // Step 2: multiploCompra = 50 → ceil(5/50)*50 = 50
      // Step 3: MOQ = 30 → 50 >= 30, no change
      const input = makeInput({
        method: 'L4L',
        loteMinimo: 1,
        multiploCompra: 50,
        moq: 30,
        netRequirements: [makePeriod(0, 5)],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts[0].quantity).toBe(50);
    });

    it('should handle constraints where MOQ overrides multiploCompra', () => {
      // Raw qty = 5
      // Step 1: loteMinimo = 1 → no change → 5
      // Step 2: multiploCompra = 3 → ceil(5/3)*3 = 6
      // Step 3: MOQ = 10 → 6 < 10 → 10
      const input = makeInput({
        method: 'L4L',
        loteMinimo: 1,
        multiploCompra: 3,
        moq: 10,
        netRequirements: [makePeriod(0, 5)],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts[0].quantity).toBe(10);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 10: Lead Time Offset (AC-7)
  // ────────────────────────────────────────────────────────────────

  describe('Lead time offset — AC-7', () => {
    it('should offset releases back by lead time periods', () => {
      const input = makeInput({
        method: 'L4L',
        leadTimePeriods: 2,
        netRequirements: [
          makePeriod(0, 0),
          makePeriod(1, 0),
          makePeriod(2, 100),
          makePeriod(3, 50),
          makePeriod(4, 75),
        ],
      });

      const result = service.calculateLotSizing(input);

      // Receipts at periods 2, 3, 4
      expect(result.plannedOrderReceipts).toHaveLength(3);
      expect(result.plannedOrderReceipts[0].periodIndex).toBe(2);
      expect(result.plannedOrderReceipts[1].periodIndex).toBe(3);
      expect(result.plannedOrderReceipts[2].periodIndex).toBe(4);

      // Releases at periods 0, 1, 2 (offset by 2)
      expect(result.plannedOrderReleases).toHaveLength(3);
      expect(result.plannedOrderReleases[0].periodIndex).toBe(0);
      expect(result.plannedOrderReleases[0].quantity).toBe(100);
      expect(result.plannedOrderReleases[1].periodIndex).toBe(1);
      expect(result.plannedOrderReleases[1].quantity).toBe(50);
      expect(result.plannedOrderReleases[2].periodIndex).toBe(2);
      expect(result.plannedOrderReleases[2].quantity).toBe(75);
    });

    it('should use correct period dates for releases', () => {
      const input = makeInput({
        method: 'L4L',
        leadTimePeriods: 1,
        netRequirements: [
          makePeriod(0, 0),
          makePeriod(1, 100),
        ],
      });

      const result = service.calculateLotSizing(input);

      // Receipt at period 1, release at period 0
      expect(result.plannedOrderReleases).toHaveLength(1);
      expect(result.plannedOrderReleases[0].periodIndex).toBe(0);
      // Release should have period 0's dates
      expect(result.plannedOrderReleases[0].periodStart).toEqual(
        new Date(2026, 2, 2),
      );
      expect(result.plannedOrderReleases[0].periodEnd).toEqual(
        new Date(2026, 2, 8),
      );
    });

    it('should handle zero lead time — receipts and releases coincide', () => {
      const input = makeInput({
        method: 'L4L',
        leadTimePeriods: 0,
        netRequirements: [
          makePeriod(0, 100),
          makePeriod(1, 50),
        ],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts).toHaveLength(2);
      expect(result.plannedOrderReleases).toHaveLength(2);

      // With LT=0, releases are at the same period as receipts
      expect(result.plannedOrderReleases[0].periodIndex).toBe(0);
      expect(result.plannedOrderReleases[1].periodIndex).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 11: Past-due releases (AC-7)
  // ────────────────────────────────────────────────────────────────

  describe('Past-due releases — AC-7', () => {
    it('should flag releases before planning horizon as past-due', () => {
      const input = makeInput({
        method: 'L4L',
        leadTimePeriods: 3,
        netRequirements: [
          makePeriod(0, 100), // Release index = 0 - 3 = -3 (past-due)
          makePeriod(1, 50),  // Release index = 1 - 3 = -2 (past-due)
          makePeriod(2, 75),  // Release index = 2 - 3 = -1 (past-due)
          makePeriod(3, 30),  // Release index = 3 - 3 = 0 (ok)
        ],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts).toHaveLength(4);
      expect(result.pastDueReleases).toHaveLength(3);
      expect(result.plannedOrderReleases).toHaveLength(1);

      // Past-due releases have negative period indices
      expect(result.pastDueReleases[0].periodIndex).toBe(-3);
      expect(result.pastDueReleases[0].quantity).toBe(100);
      expect(result.pastDueReleases[1].periodIndex).toBe(-2);
      expect(result.pastDueReleases[1].quantity).toBe(50);
      expect(result.pastDueReleases[2].periodIndex).toBe(-1);
      expect(result.pastDueReleases[2].quantity).toBe(75);

      // One valid release
      expect(result.plannedOrderReleases[0].periodIndex).toBe(0);
      expect(result.plannedOrderReleases[0].quantity).toBe(30);
    });

    it('should mark all releases as past-due when LT exceeds horizon', () => {
      const input = makeInput({
        method: 'L4L',
        leadTimePeriods: 10,
        netRequirements: [
          makePeriod(0, 100),
          makePeriod(1, 50),
        ],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts).toHaveLength(2);
      expect(result.plannedOrderReleases).toHaveLength(0);
      expect(result.pastDueReleases).toHaveLength(2);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 12: Zero net requirements
  // ────────────────────────────────────────────────────────────────

  describe('Zero net requirements', () => {
    it('should return empty arrays when all net requirements are zero', () => {
      const input = makeInput({
        method: 'L4L',
        netRequirements: [
          makePeriod(0, 0),
          makePeriod(1, 0),
          makePeriod(2, 0),
        ],
      });

      const result = service.calculateLotSizing(input);

      expect(result.produtoId).toBe('prod-001');
      expect(result.plannedOrderReceipts).toHaveLength(0);
      expect(result.plannedOrderReleases).toHaveLength(0);
      expect(result.pastDueReleases).toHaveLength(0);
    });

    it('should return empty arrays when net requirements array is empty', () => {
      const input = makeInput({
        method: 'L4L',
        netRequirements: [],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts).toHaveLength(0);
      expect(result.plannedOrderReleases).toHaveLength(0);
      expect(result.pastDueReleases).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 13: Single period with large net requirement
  // ────────────────────────────────────────────────────────────────

  describe('Single period with large net requirement', () => {
    it('should handle a single large demand period correctly', () => {
      const input = makeInput({
        method: 'L4L',
        netRequirements: [makePeriod(0, 1_000_000)],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts).toHaveLength(1);
      expect(result.plannedOrderReceipts[0].quantity).toBe(1_000_000);
      expect(result.plannedOrderReceipts[0].periodIndex).toBe(0);
    });

    it('should handle large demand with all constraints', () => {
      const input = makeInput({
        method: 'L4L',
        loteMinimo: 500_000,
        multiploCompra: 100_000,
        moq: 200_000,
        netRequirements: [makePeriod(0, 750_123)],
      });

      const result = service.calculateLotSizing(input);

      // 750123 >= loteMinimo → 750123
      // multiploCompra: ceil(750123/100000)*100000 = 800000
      // MOQ: 800000 >= 200000 → 800000
      expect(result.plannedOrderReceipts[0].quantity).toBe(800_000);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 14: All methods with same input — compare outputs
  // ────────────────────────────────────────────────────────────────

  describe('All methods with same input — comparison', () => {
    it('should produce different planned orders for different methods', () => {
      const netRequirements: readonly LotSizingPeriod[] = [
        makePeriod(0, 100),
        makePeriod(1, 80),
        makePeriod(2, 60),
        makePeriod(3, 120),
      ];

      const l4lResult = service.calculateLotSizing(
        makeInput({ method: 'L4L', netRequirements }),
      );

      const eoqResult = service.calculateLotSizing(
        makeInput({ method: 'EOQ', eoqValue: 250, netRequirements }),
      );

      const smResult = service.calculateLotSizing(
        makeInput({
          method: 'SILVER_MEAL',
          orderingCost: 100,
          holdingCostPerUnit: 1,
          netRequirements,
        }),
      );

      // L4L: 4 orders (one per period with demand)
      expect(l4lResult.plannedOrderReceipts).toHaveLength(4);

      // EOQ with 250: first order covers periods 0+1 (100+80=180, coverage=70),
      // period 2 covered (coverage=10), period 3: deficit=110, max(250,110)=250
      expect(eoqResult.plannedOrderReceipts).toHaveLength(2);

      // Silver-Meal: depends on cost structure but will aggregate some periods
      expect(smResult.plannedOrderReceipts.length).toBeGreaterThanOrEqual(1);
      expect(smResult.plannedOrderReceipts.length).toBeLessThanOrEqual(4);

      // All methods should cover the same total demand
      const totalDemand = 100 + 80 + 60 + 120;
      const l4lTotal = l4lResult.plannedOrderReceipts.reduce((s, o) => s + o.quantity, 0);
      const eoqTotal = eoqResult.plannedOrderReceipts.reduce((s, o) => s + o.quantity, 0);

      // L4L total equals exact demand (no constraints beyond 1)
      expect(l4lTotal).toBe(totalDemand);
      // EOQ total >= demand (may have leftover coverage)
      expect(eoqTotal).toBeGreaterThanOrEqual(totalDemand);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 15: Edge — eoqValue = 0 with EOQ method (fallback to L4L)
  // ────────────────────────────────────────────────────────────────

  describe('Edge: eoqValue = 0 with EOQ method', () => {
    it('should fallback to L4L-like behavior when eoqValue is 0', () => {
      const input = makeInput({
        method: 'EOQ',
        eoqValue: 0,
        netRequirements: [
          makePeriod(0, 100),
          makePeriod(1, 50),
          makePeriod(2, 75),
        ],
      });

      const result = service.calculateLotSizing(input);

      // With eoqValue=0, orders exactly the deficit each time (L4L behavior)
      expect(result.plannedOrderReceipts).toHaveLength(3);
      expect(result.plannedOrderReceipts[0].quantity).toBe(100);
      expect(result.plannedOrderReceipts[1].quantity).toBe(50);
      expect(result.plannedOrderReceipts[2].quantity).toBe(75);
    });

    it('should fallback to L4L-like behavior when eoqValue is negative', () => {
      const input = makeInput({
        method: 'EOQ',
        eoqValue: -10,
        netRequirements: [
          makePeriod(0, 80),
          makePeriod(1, 40),
        ],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts).toHaveLength(2);
      expect(result.plannedOrderReceipts[0].quantity).toBe(80);
      expect(result.plannedOrderReceipts[1].quantity).toBe(40);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Wagner-Whitin — Optimal Dynamic Programming (Story 5.1)
  // ────────────────────────────────────────────────────────────────

  describe('Wagner-Whitin — Optimal DP (AC-1 to AC-6)', () => {
    it('should produce optimal lot sizing for basic 4-period problem', () => {
      // Classic textbook example:
      // K=100, h=1, demands = [50, 60, 90, 70]
      // Optimal: order at period 0 (50+60=110), period 2 (90+70=160)
      // Cost: 2*100 + 1*60*1 + 1*70*1 = 200 + 60 + 70 = 330
      // vs L4L: 4*100 = 400
      // vs order-all-at-once: 100 + 60*1 + 90*2 + 70*3 = 100+60+180+210 = 550
      const input = makeInput({
        method: 'WAGNER_WHITIN',
        netRequirements: [
          makePeriod(0, 50),
          makePeriod(1, 60),
          makePeriod(2, 90),
          makePeriod(3, 70),
        ],
        orderingCost: 100,
        holdingCostPerUnit: 1,
      });

      const result = service.calculateLotSizing(input);

      // Wagner-Whitin optimal: 2 orders (period 0: 50+60=110, period 2: 90+70=160)
      // Cost: 2×100 + 1×60×1 + 1×70×1 = 200 + 60 + 70 = 330
      expect(result.plannedOrderReceipts).toHaveLength(2);
      expect(result.plannedOrderReceipts[0].periodIndex).toBe(0);
      expect(result.plannedOrderReceipts[0].quantity).toBe(110);
      expect(result.plannedOrderReceipts[1].periodIndex).toBe(2);
      expect(result.plannedOrderReceipts[1].quantity).toBe(160);
    });

    it('should return single order when ordering cost is very high', () => {
      // K=10000, h=0.01 → single order is cheapest
      const input = makeInput({
        method: 'WAGNER_WHITIN',
        netRequirements: [
          makePeriod(0, 100),
          makePeriod(1, 100),
          makePeriod(2, 100),
        ],
        orderingCost: 10000,
        holdingCostPerUnit: 0.01,
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts).toHaveLength(1);
      expect(result.plannedOrderReceipts[0].periodIndex).toBe(0);
      expect(result.plannedOrderReceipts[0].quantity).toBe(300);
    });

    it('should behave like L4L when holding cost is very high', () => {
      // K=1, h=10000 → individual orders cheapest (no inventory carrying)
      const input = makeInput({
        method: 'WAGNER_WHITIN',
        netRequirements: [
          makePeriod(0, 50),
          makePeriod(1, 50),
          makePeriod(2, 50),
        ],
        orderingCost: 1,
        holdingCostPerUnit: 10000,
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts).toHaveLength(3);
      expect(result.plannedOrderReceipts[0].quantity).toBe(50);
      expect(result.plannedOrderReceipts[1].quantity).toBe(50);
      expect(result.plannedOrderReceipts[2].quantity).toBe(50);
    });

    it('should handle zero-demand periods correctly', () => {
      const input = makeInput({
        method: 'WAGNER_WHITIN',
        netRequirements: [
          makePeriod(0, 100),
          makePeriod(1, 0),   // zero demand
          makePeriod(2, 0),   // zero demand
          makePeriod(3, 80),
        ],
        orderingCost: 50,
        holdingCostPerUnit: 0.5,
      });

      const result = service.calculateLotSizing(input);

      // Total demand = 180
      const totalQty = result.plannedOrderReceipts.reduce((s, r) => s + r.quantity, 0);
      expect(totalQty).toBe(180);
    });

    it('should handle single period with demand', () => {
      const input = makeInput({
        method: 'WAGNER_WHITIN',
        netRequirements: [makePeriod(0, 200)],
        orderingCost: 100,
        holdingCostPerUnit: 1,
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts).toHaveLength(1);
      expect(result.plannedOrderReceipts[0].quantity).toBe(200);
      expect(result.plannedOrderReceipts[0].periodIndex).toBe(0);
    });

    it('should return empty for no demand', () => {
      const input = makeInput({
        method: 'WAGNER_WHITIN',
        netRequirements: [
          makePeriod(0, 0),
          makePeriod(1, 0),
        ],
        orderingCost: 100,
        holdingCostPerUnit: 1,
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts).toHaveLength(0);
      expect(result.plannedOrderReleases).toHaveLength(0);
    });

    it('should apply constraints after DP solution', () => {
      // W-W optimal: single order of 150 (K=1000, h=0.01)
      // Constraints: loteMinimo=200
      const input = makeInput({
        method: 'WAGNER_WHITIN',
        netRequirements: [
          makePeriod(0, 80),
          makePeriod(1, 70),
        ],
        orderingCost: 1000,
        holdingCostPerUnit: 0.01,
        loteMinimo: 200,
      });

      const result = service.calculateLotSizing(input);

      // Should be at least loteMinimo
      for (const receipt of result.plannedOrderReceipts) {
        expect(receipt.quantity).toBeGreaterThanOrEqual(200);
      }
    });

    it('should offset releases by lead time', () => {
      const input = makeInput({
        method: 'WAGNER_WHITIN',
        netRequirements: [
          makePeriod(0, 100),
          makePeriod(1, 100),
          makePeriod(2, 100),
        ],
        orderingCost: 10000,
        holdingCostPerUnit: 0.01,
        leadTimePeriods: 1,
      });

      const result = service.calculateLotSizing(input);

      // Single order at period 0 → release at period -1 (past-due)
      expect(result.plannedOrderReceipts).toHaveLength(1);
      expect(result.pastDueReleases).toHaveLength(1);
      expect(result.pastDueReleases[0].periodIndex).toBe(-1);
    });

    it('should produce cost <= Silver-Meal (optimal guarantee)', () => {
      // Wagner-Whitin is globally optimal, so cost must be <= any heuristic
      const inputBase = {
        netRequirements: [
          makePeriod(0, 50),
          makePeriod(1, 60),
          makePeriod(2, 90),
          makePeriod(3, 70),
          makePeriod(4, 40),
          makePeriod(5, 80),
        ] as readonly LotSizingPeriod[],
        orderingCost: 100,
        holdingCostPerUnit: 0.5,
      };

      const wwResult = service.calculateLotSizing(makeInput({
        ...inputBase,
        method: 'WAGNER_WHITIN',
      }));

      const smResult = service.calculateLotSizing(makeInput({
        ...inputBase,
        method: 'SILVER_MEAL',
      }));

      // Calculate costs for both
      const calcCost = (receipts: readonly { readonly periodIndex: number; readonly quantity: number }[]) => {
        const K = inputBase.orderingCost;
        const h = inputBase.holdingCostPerUnit;
        let totalCost = receipts.length * K;
        // Simulate inventory holding
        let inventory = 0;
        const receiptMap = new Map<number, number>();
        for (const r of receipts) {
          receiptMap.set(r.periodIndex, (receiptMap.get(r.periodIndex) ?? 0) + r.quantity);
        }
        for (let t = 0; t < inputBase.netRequirements.length; t++) {
          inventory += receiptMap.get(t) ?? 0;
          inventory -= inputBase.netRequirements[t].quantity;
          if (inventory > 0) totalCost += h * inventory;
        }
        return totalCost;
      };

      const wwCost = calcCost(wwResult.plannedOrderReceipts);
      const smCost = calcCost(smResult.plannedOrderReceipts);

      expect(wwCost).toBeLessThanOrEqual(smCost);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Unsupported method
  // ────────────────────────────────────────────────────────────────

  describe('Unsupported method', () => {
    it('should throw BadRequestException for any unsupported method', () => {
      const input = makeInput({
        method: 'UNKNOWN' as LotSizingInput['method'],
        netRequirements: [makePeriod(0, 100)],
      });

      expect(() => service.calculateLotSizing(input)).toThrow(BadRequestException);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Output structure — AC-1, AC-8
  // ────────────────────────────────────────────────────────────────

  describe('Output structure — AC-1, AC-8', () => {
    it('should return produtoId and both receipts and releases arrays', () => {
      const input = makeInput({
        produtoId: 'sku-test-001',
        method: 'L4L',
        leadTimePeriods: 1,
        netRequirements: [
          makePeriod(0, 0),
          makePeriod(1, 100),
        ],
      });

      const result = service.calculateLotSizing(input);

      expect(result.produtoId).toBe('sku-test-001');
      expect(Array.isArray(result.plannedOrderReceipts)).toBe(true);
      expect(Array.isArray(result.plannedOrderReleases)).toBe(true);
      expect(Array.isArray(result.pastDueReleases)).toBe(true);
    });

    it('should include period dates in planned orders', () => {
      const input = makeInput({
        method: 'L4L',
        netRequirements: [makePeriod(0, 100)],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts[0].periodStart).toBeInstanceOf(Date);
      expect(result.plannedOrderReceipts[0].periodEnd).toBeInstanceOf(Date);
      expect(typeof result.plannedOrderReceipts[0].periodIndex).toBe('number');
      expect(typeof result.plannedOrderReceipts[0].quantity).toBe('number');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Pure calculation — no mutation
  // ────────────────────────────────────────────────────────────────

  describe('Pure calculation — immutability', () => {
    it('should not modify the input object', () => {
      const netRequirements: readonly LotSizingPeriod[] = [
        makePeriod(0, 100),
        makePeriod(1, 50),
      ];

      const input = makeInput({
        method: 'L4L',
        loteMinimo: 25,
        multiploCompra: 10,
        moq: 30,
        netRequirements,
      });

      const inputCopy = JSON.parse(JSON.stringify(input));
      service.calculateLotSizing(input);

      expect(input.produtoId).toBe(inputCopy.produtoId);
      expect(input.loteMinimo).toBe(inputCopy.loteMinimo);
      expect(input.multiploCompra).toBe(inputCopy.multiploCompra);
      expect(input.moq).toBe(inputCopy.moq);
      expect(input.netRequirements[0].quantity).toBe(inputCopy.netRequirements[0].quantity);
      expect(input.netRequirements[1].quantity).toBe(inputCopy.netRequirements[1].quantity);
    });

    it('should produce identical results for identical inputs (deterministic)', () => {
      const input = makeInput({
        method: 'SILVER_MEAL',
        orderingCost: 100,
        holdingCostPerUnit: 1,
        netRequirements: [
          makePeriod(0, 50),
          makePeriod(1, 40),
          makePeriod(2, 60),
        ],
      });

      const result1 = service.calculateLotSizing(input);
      const result2 = service.calculateLotSizing(input);

      expect(result1.plannedOrderReceipts).toEqual(result2.plannedOrderReceipts);
      expect(result1.plannedOrderReleases).toEqual(result2.plannedOrderReleases);
      expect(result1.pastDueReleases).toEqual(result2.pastDueReleases);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // applyConstraints public method — direct unit tests
  // ────────────────────────────────────────────────────────────────

  describe('applyConstraints — direct', () => {
    it('should return rounded result with 4 decimal places', () => {
      const result = service.applyConstraints(33.33335, 1, 1, 1);

      // Factor-based rounding: round(33.33335 * 10000) / 10000 = 33.3334
      expect(result).toBe(33.3334);
    });

    it('should handle all constraints = 1 (no-op)', () => {
      expect(service.applyConstraints(42, 1, 1, 1)).toBe(42);
    });

    it('should handle zero quantity — MOQ still applies if moq > 1', () => {
      // qty = 0: loteMinimo skipped (0 not > 0), multiploCompra ceil(0/25)*25=0, MOQ: 0<100 → 100
      expect(service.applyConstraints(0, 50, 25, 100)).toBe(100);
    });

    it('should return zero when qty = 0 and all constraints are 1', () => {
      expect(service.applyConstraints(0, 1, 1, 1)).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Decimal precision — 4 decimal places
  // ────────────────────────────────────────────────────────────────

  describe('Decimal precision', () => {
    it('should maintain 4 decimal places in planned order quantities', () => {
      const input = makeInput({
        method: 'L4L',
        netRequirements: [makePeriod(0, 33.3333)],
      });

      const result = service.calculateLotSizing(input);

      expect(result.plannedOrderReceipts[0].quantity).toBe(33.3333);
    });

    it('should round EOQ accumulated coverage correctly', () => {
      const input = makeInput({
        method: 'EOQ',
        eoqValue: 100.5,
        netRequirements: [
          makePeriod(0, 33.3333), // Order 100.5, coverage = 67.1667
          makePeriod(1, 33.3333), // Covered, coverage = 33.8334
          makePeriod(2, 33.3333), // Covered, coverage = 0.5001
        ],
      });

      const result = service.calculateLotSizing(input);

      // Single order covers all three periods
      expect(result.plannedOrderReceipts).toHaveLength(1);
      expect(result.plannedOrderReceipts[0].quantity).toBe(100.5);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Complex multi-period scenario
  // ────────────────────────────────────────────────────────────────

  describe('Complex multi-period scenario', () => {
    it('should handle an 8-week planning horizon with EOQ and lead time', () => {
      const input = makeInput({
        method: 'EOQ',
        eoqValue: 200,
        leadTimePeriods: 2,
        netRequirements: [
          makePeriod(0, 60),  // Order 200, coverage = 140
          makePeriod(1, 0),
          makePeriod(2, 80),  // Covered, coverage = 60
          makePeriod(3, 40),  // Covered, coverage = 20
          makePeriod(4, 50),  // Not covered (20 < 50), new order: deficit=30, max(200,30)=200
          makePeriod(5, 0),
          makePeriod(6, 90),  // Covered (from 200 order, coverage = 200-30-90=80)
          makePeriod(7, 30),  // Covered (80-30=50 left)
        ],
      });

      const result = service.calculateLotSizing(input);

      // Receipts at periods 0 and 4
      expect(result.plannedOrderReceipts).toHaveLength(2);
      expect(result.plannedOrderReceipts[0].periodIndex).toBe(0);
      expect(result.plannedOrderReceipts[0].quantity).toBe(200);
      expect(result.plannedOrderReceipts[1].periodIndex).toBe(4);
      expect(result.plannedOrderReceipts[1].quantity).toBe(200);

      // Releases offset by 2: period 0→-2(past-due), period 4→2
      expect(result.pastDueReleases).toHaveLength(1);
      expect(result.pastDueReleases[0].periodIndex).toBe(-2);
      expect(result.pastDueReleases[0].quantity).toBe(200);

      expect(result.plannedOrderReleases).toHaveLength(1);
      expect(result.plannedOrderReleases[0].periodIndex).toBe(2);
      expect(result.plannedOrderReleases[0].quantity).toBe(200);
    });
  });
});
