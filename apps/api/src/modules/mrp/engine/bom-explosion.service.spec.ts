import { BadRequestException } from '@nestjs/common';

import { BomExplosionService } from './bom-explosion.service';
import type {
  BomExplosionInput,
  BomLineInput,
  TimePhasedDemand,
} from './interfaces/bom-explosion.interface';

/**
 * Unit tests for BomExplosionService — Multi-Level BOM Explosion Engine
 *
 * Test cases cover AC-11 requirements:
 * - AC-1: Low-level code assignment
 * - AC-2: Level 0 = ACABADO, processing level by level
 * - AC-3: Item at multiple levels gets HIGHEST level number
 * - AC-4/AC-5/AC-6: Gross requirement calculation with loss percentage
 * - AC-7: Explosion processes all levels until leaf nodes
 * - AC-8: Shared components sum requirements from multiple parents
 * - AC-9: Circular BOM detection
 * - AC-10: Output map of produtoId -> time-phased gross requirements
 * - AC-11: >= 80% coverage with comprehensive test cases
 *
 * @see Story 3.4 — Multi-Level BOM Explosion
 */
describe('BomExplosionService', () => {
  let service: BomExplosionService;

  beforeEach(() => {
    service = new BomExplosionService();
  });

  // ────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────

  /** Create a time-phased demand entry for a given week offset */
  const makeDemand = (weekOffset: number, quantity: number): TimePhasedDemand => ({
    periodStart: new Date(2026, 2, 2 + weekOffset * 7), // March 2026, Monday
    periodEnd: new Date(2026, 2, 8 + weekOffset * 7),   // Following Sunday
    quantity,
  });

  /** Create a BOM line */
  const makeBomLine = (
    parentId: string,
    childId: string,
    quantidade: number,
    perdaPercentual = 0,
  ): BomLineInput => ({
    produtoPaiId: parentId,
    produtoFilhoId: childId,
    quantidade,
    perdaPercentual,
  });

  /** Create a complete BomExplosionInput */
  const makeInput = (overrides: Partial<BomExplosionInput> = {}): BomExplosionInput => ({
    mpsRequirements: overrides.mpsRequirements ?? new Map(),
    bomLines: overrides.bomLines ?? [],
    productTypes: overrides.productTypes ?? new Map(),
  });

  /** Helper to get gross requirement quantity for a product at a specific period */
  const getGrossQty = (
    grossRequirements: ReadonlyMap<string, readonly TimePhasedDemand[]>,
    produtoId: string,
    weekOffset: number,
  ): number | undefined => {
    const demands = grossRequirements.get(produtoId);
    if (!demands) return undefined;

    const periodStart = new Date(2026, 2, 2 + weekOffset * 7);
    const found = demands.find(
      (d) => d.periodStart.getTime() === periodStart.getTime(),
    );
    return found?.quantity;
  };

  // ────────────────────────────────────────────────────────────────
  // Test Case 1: Single-Level BOM (AC-1, AC-2, AC-4, AC-5, AC-10)
  // ────────────────────────────────────────────────────────────────

  describe('Single-level BOM', () => {
    it('should explode a finished product with 3 components and verify gross requirements', () => {
      // Product A (ACABADO) -> Component B (qty=2), C (qty=3), D (qty=1)
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 100), makeDemand(1, 150)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 2),
        makeBomLine('prod-A', 'comp-C', 3),
        makeBomLine('prod-A', 'comp-D', 1),
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      // Verify low-level codes
      expect(result.lowLevelCodes['prod-A']).toBe(0);
      expect(result.lowLevelCodes['comp-B']).toBe(1);
      expect(result.lowLevelCodes['comp-C']).toBe(1);
      expect(result.lowLevelCodes['comp-D']).toBe(1);

      // Verify gross requirements for components
      // comp-B: 100 * 2 = 200 (week 0), 150 * 2 = 300 (week 1)
      expect(getGrossQty(result.grossRequirements, 'comp-B', 0)).toBe(200);
      expect(getGrossQty(result.grossRequirements, 'comp-B', 1)).toBe(300);

      // comp-C: 100 * 3 = 300 (week 0), 150 * 3 = 450 (week 1)
      expect(getGrossQty(result.grossRequirements, 'comp-C', 0)).toBe(300);
      expect(getGrossQty(result.grossRequirements, 'comp-C', 1)).toBe(450);

      // comp-D: 100 * 1 = 100 (week 0), 150 * 1 = 150 (week 1)
      expect(getGrossQty(result.grossRequirements, 'comp-D', 0)).toBe(100);
      expect(getGrossQty(result.grossRequirements, 'comp-D', 1)).toBe(150);
    });

    it('should preserve MPS requirements for the finished product in the output', () => {
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 50)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 2),
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      // MPS requirements for prod-A should still be in grossRequirements
      expect(getGrossQty(result.grossRequirements, 'prod-A', 0)).toBe(50);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test Case 2: Multi-Level BOM — 3 Levels (AC-5, AC-7)
  // ────────────────────────────────────────────────────────────────

  describe('Multi-level BOM (3 levels)', () => {
    it('should cascade requirements correctly through 3 levels with loss percentages', () => {
      // Level 0: Product A (ACABADO) — MPS demand = 100
      // Level 1: Sub-assembly B (qty=2, loss=5%)
      // Level 2: Raw material C (qty=3, loss=2%)
      //
      // Expected:
      //   B gross = 100 * 2 * (1 + 5/100) = 100 * 2 * 1.05 = 210
      //   C gross = 210 * 3 * (1 + 2/100) = 210 * 3 * 1.02 = 642.6
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 100)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'sub-B', 2, 5),   // 5% loss
        makeBomLine('sub-B', 'raw-C', 3, 2),     // 2% loss
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      // Low-level codes
      expect(result.lowLevelCodes['prod-A']).toBe(0);
      expect(result.lowLevelCodes['sub-B']).toBe(1);
      expect(result.lowLevelCodes['raw-C']).toBe(2);

      // sub-B: 100 * 2 * 1.05 = 210
      expect(getGrossQty(result.grossRequirements, 'sub-B', 0)).toBe(210);

      // raw-C: 210 * 3 * 1.02 = 642.6
      expect(getGrossQty(result.grossRequirements, 'raw-C', 0)).toBe(642.6);
    });

    it('should handle multi-period demands cascading through multiple levels', () => {
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 50), makeDemand(1, 80)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'sub-B', 2, 0),
        makeBomLine('sub-B', 'raw-C', 4, 0),
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      // sub-B: week 0 = 50*2=100, week 1 = 80*2=160
      expect(getGrossQty(result.grossRequirements, 'sub-B', 0)).toBe(100);
      expect(getGrossQty(result.grossRequirements, 'sub-B', 1)).toBe(160);

      // raw-C: week 0 = 100*4=400, week 1 = 160*4=640
      expect(getGrossQty(result.grossRequirements, 'raw-C', 0)).toBe(400);
      expect(getGrossQty(result.grossRequirements, 'raw-C', 1)).toBe(640);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test Case 3: Shared Component (AC-8)
  // ────────────────────────────────────────────────────────────────

  describe('Shared component — requirements summed from multiple parents', () => {
    it('should sum gross requirements when a component is used by 2 parents', () => {
      // Product A -> Component D (qty=2)
      // Product A -> Component E (qty=1)
      // Component D -> Raw F (qty=3)
      // Component E -> Raw F (qty=2)  <-- F is shared
      //
      // MPS: A = 100
      // D gross = 100 * 2 = 200
      // E gross = 100 * 1 = 100
      // F gross from D = 200 * 3 = 600
      // F gross from E = 100 * 2 = 200
      // F total gross = 600 + 200 = 800
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 100)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-D', 2),
        makeBomLine('prod-A', 'comp-E', 1),
        makeBomLine('comp-D', 'raw-F', 3),
        makeBomLine('comp-E', 'raw-F', 2),
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      // F should have summed requirements from both parents
      expect(getGrossQty(result.grossRequirements, 'raw-F', 0)).toBe(800);
    });

    it('should sum requirements from multiple finished products for a shared component', () => {
      // Product A (ACABADO) -> Component X (qty=3)
      // Product B (ACABADO) -> Component X (qty=5)
      //
      // MPS: A=40, B=60
      // X from A = 40 * 3 = 120
      // X from B = 60 * 5 = 300
      // X total = 420
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 40)]],
        ['prod-B', [makeDemand(0, 60)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-X', 3),
        makeBomLine('prod-B', 'comp-X', 5),
      ];

      const productTypes = new Map([
        ['prod-A', 'ACABADO'],
        ['prod-B', 'ACABADO'],
      ]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      expect(getGrossQty(result.grossRequirements, 'comp-X', 0)).toBe(420);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test Case 4: Low-Level Coding (AC-1, AC-2, AC-3)
  // ────────────────────────────────────────────────────────────────

  describe('Low-level coding', () => {
    it('should assign the HIGHEST level number when item appears at multiple levels (AC-3)', () => {
      // Product A (level 0)
      //   -> Component B (level 1)
      //     -> Component D (level 2)
      //   -> Component C (level 1)
      //     -> Component D (level 2)
      //
      // Product E (level 0)
      //   -> Component D (level 1)
      //
      // D appears at level 1 (from E) and level 2 (from A->B and A->C)
      // Result: D should get low-level code = 2 (highest)
      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 1),
        makeBomLine('prod-A', 'comp-C', 1),
        makeBomLine('comp-B', 'comp-D', 1),
        makeBomLine('comp-C', 'comp-D', 1),
        makeBomLine('prod-E', 'comp-D', 1),
      ];

      const productTypes = new Map([
        ['prod-A', 'ACABADO'],
        ['prod-E', 'ACABADO'],
      ]);

      const result = service.assignLowLevelCodes(bomLines, productTypes);

      expect(result['prod-A']).toBe(0);
      expect(result['prod-E']).toBe(0);
      expect(result['comp-B']).toBe(1);
      expect(result['comp-C']).toBe(1);
      expect(result['comp-D']).toBe(2); // Highest level from all paths
    });

    it('should assign level 0 to ACABADO products only', () => {
      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 1),
      ];

      const productTypes = new Map([
        ['prod-A', 'ACABADO'],
        ['comp-B', 'MATERIA_PRIMA'],
      ]);

      const result = service.assignLowLevelCodes(bomLines, productTypes);

      expect(result['prod-A']).toBe(0);
      expect(result['comp-B']).toBe(1);
    });

    it('should handle deep hierarchies (5+ levels)', () => {
      const bomLines: BomLineInput[] = [
        makeBomLine('L0', 'L1', 1),
        makeBomLine('L1', 'L2', 1),
        makeBomLine('L2', 'L3', 1),
        makeBomLine('L3', 'L4', 1),
        makeBomLine('L4', 'L5', 1),
      ];

      const productTypes = new Map([['L0', 'ACABADO']]);

      const result = service.assignLowLevelCodes(bomLines, productTypes);

      expect(result['L0']).toBe(0);
      expect(result['L1']).toBe(1);
      expect(result['L2']).toBe(2);
      expect(result['L3']).toBe(3);
      expect(result['L4']).toBe(4);
      expect(result['L5']).toBe(5);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test Case 5: Loss Percentage (AC-6)
  // ────────────────────────────────────────────────────────────────

  describe('Loss percentage — AC-6 formula verification', () => {
    it('should apply loss percentage: componentGross = parentQty * bomQty * (1 + loss/100)', () => {
      // Parent gross = 200, BOM qty = 3, loss = 10%
      // Expected: 200 * 3 * (1 + 10/100) = 200 * 3 * 1.10 = 660
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 200)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 3, 10), // 10% loss
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      expect(getGrossQty(result.grossRequirements, 'comp-B', 0)).toBe(660);
    });

    it('should handle zero loss percentage (no loss)', () => {
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 100)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 5, 0),
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      // 100 * 5 * (1 + 0/100) = 500
      expect(getGrossQty(result.grossRequirements, 'comp-B', 0)).toBe(500);
    });

    it('should handle fractional loss percentage', () => {
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 100)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 2, 2.5), // 2.5% loss
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      // 100 * 2 * (1 + 2.5/100) = 100 * 2 * 1.025 = 205
      expect(getGrossQty(result.grossRequirements, 'comp-B', 0)).toBe(205);
    });

    it('should compound loss percentages across multiple levels', () => {
      // A -> B (qty=1, loss=10%)
      // B -> C (qty=1, loss=5%)
      //
      // MPS A = 1000
      // B gross = 1000 * 1 * 1.10 = 1100
      // C gross = 1100 * 1 * 1.05 = 1155
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 1000)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 1, 10),
        makeBomLine('comp-B', 'comp-C', 1, 5),
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      expect(getGrossQty(result.grossRequirements, 'comp-B', 0)).toBe(1100);
      expect(getGrossQty(result.grossRequirements, 'comp-C', 0)).toBe(1155);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test Case 6: Circular BOM Detection (AC-9)
  // ────────────────────────────────────────────────────────────────

  describe('Circular BOM detection — AC-9', () => {
    it('should detect a direct circular reference (A -> B -> A)', () => {
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 100)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 1),
        makeBomLine('comp-B', 'prod-A', 1), // Circular!
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });

      expect(() => service.explode(input)).toThrow(BadRequestException);
    });

    it('should detect an indirect circular reference (A -> B -> C -> A)', () => {
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 100)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 1),
        makeBomLine('comp-B', 'comp-C', 1),
        makeBomLine('comp-C', 'prod-A', 1), // Circular!
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });

      expect(() => service.explode(input)).toThrow(BadRequestException);
    });

    it('should include the circular path in the error message', () => {
      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 1),
        makeBomLine('comp-B', 'comp-C', 1),
        makeBomLine('comp-C', 'prod-A', 1),
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({
        mpsRequirements: new Map([['prod-A', [makeDemand(0, 100)]]]),
        bomLines,
        productTypes,
      });

      expect(() => service.explode(input)).toThrow(
        /Circular BOM reference detected/,
      );
    });

    it('should detect a self-referencing cycle (A -> A)', () => {
      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'prod-A', 1), // Self-reference!
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({
        mpsRequirements: new Map([['prod-A', [makeDemand(0, 100)]]]),
        bomLines,
        productTypes,
      });

      expect(() => service.explode(input)).toThrow(BadRequestException);
    });

    it('should NOT throw for a valid DAG (diamond shape without cycles)', () => {
      // A -> B -> D
      // A -> C -> D  (diamond, but no cycle)
      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 1),
        makeBomLine('prod-A', 'comp-C', 1),
        makeBomLine('comp-B', 'comp-D', 1),
        makeBomLine('comp-C', 'comp-D', 1),
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({
        mpsRequirements: new Map([['prod-A', [makeDemand(0, 100)]]]),
        bomLines,
        productTypes,
      });

      expect(() => service.explode(input)).not.toThrow();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test Case 7: Empty BOM / Leaf Items (AC-7)
  // ────────────────────────────────────────────────────────────────

  describe('Leaf items — purchased items with no children', () => {
    it('should not generate child requirements for leaf items', () => {
      // Product A (ACABADO) -> Component B (leaf, no children)
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 100)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 2),
        // comp-B has no children — it's a leaf
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      // comp-B should have its gross requirements
      expect(getGrossQty(result.grossRequirements, 'comp-B', 0)).toBe(200);

      // No further explosion beyond comp-B
      const allProductIds = Array.from(result.grossRequirements.keys());
      expect(allProductIds).toContain('prod-A');
      expect(allProductIds).toContain('comp-B');
      expect(allProductIds).toHaveLength(2);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test Case 8: Zero Demand
  // ────────────────────────────────────────────────────────────────

  describe('Edge case: zero demand', () => {
    it('should not generate child requirements when parent demand is zero', () => {
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 0)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 5),
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      // comp-B gross = 0 * 5 = 0
      expect(getGrossQty(result.grossRequirements, 'comp-B', 0)).toBe(0);
    });

    it('should handle mixed zero and non-zero demands across periods', () => {
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 0), makeDemand(1, 100), makeDemand(2, 0)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 3),
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      expect(getGrossQty(result.grossRequirements, 'comp-B', 0)).toBe(0);
      expect(getGrossQty(result.grossRequirements, 'comp-B', 1)).toBe(300);
      expect(getGrossQty(result.grossRequirements, 'comp-B', 2)).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test Case 9: Empty Input
  // ────────────────────────────────────────────────────────────────

  describe('Edge case: empty input', () => {
    it('should return empty result when no bomLines and no mpsRequirements', () => {
      const input = makeInput({
        mpsRequirements: new Map(),
        bomLines: [],
        productTypes: new Map(),
      });

      const result = service.explode(input);

      expect(Object.keys(result.lowLevelCodes)).toHaveLength(0);
      expect(result.grossRequirements.size).toBe(0);
    });

    it('should return empty result when bomLines exist but no mpsRequirements', () => {
      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 2),
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({
        mpsRequirements: new Map(),
        bomLines,
        productTypes,
      });

      const result = service.explode(input);

      // Low-level codes are still assigned, but no gross requirements generated
      expect(result.lowLevelCodes['prod-A']).toBe(0);
      expect(result.lowLevelCodes['comp-B']).toBe(1);
      expect(result.grossRequirements.size).toBe(0);
    });

    it('should handle mpsRequirements with no matching BOM lines', () => {
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 100)]],
      ]);

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({
        mpsRequirements,
        bomLines: [],
        productTypes,
      });

      const result = service.explode(input);

      // prod-A should still have its MPS requirements, but no explosion happens
      expect(getGrossQty(result.grossRequirements, 'prod-A', 0)).toBe(100);
      expect(result.grossRequirements.size).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Immutability and Determinism
  // ────────────────────────────────────────────────────────────────

  describe('Immutability and determinism', () => {
    it('should not modify the input data', () => {
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 100)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 2),
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const mpsCopy = JSON.parse(JSON.stringify(Array.from(mpsRequirements.entries())));
      const bomCopy = JSON.parse(JSON.stringify(bomLines));

      service.explode(input);

      // Verify input was not mutated
      expect(JSON.stringify(Array.from(mpsRequirements.entries()))).toBe(
        JSON.stringify(mpsCopy),
      );
      expect(JSON.stringify(bomLines)).toBe(JSON.stringify(bomCopy));
    });

    it('should produce identical results for identical inputs (deterministic)', () => {
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 100), makeDemand(1, 200)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 3, 5),
        makeBomLine('comp-B', 'raw-C', 2, 2),
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });

      const result1 = service.explode(input);
      const result2 = service.explode(input);

      expect(getGrossQty(result1.grossRequirements, 'comp-B', 0)).toBe(
        getGrossQty(result2.grossRequirements, 'comp-B', 0),
      );
      expect(getGrossQty(result1.grossRequirements, 'raw-C', 0)).toBe(
        getGrossQty(result2.grossRequirements, 'raw-C', 0),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Precision
  // ────────────────────────────────────────────────────────────────

  describe('Precision — 4-decimal rounding', () => {
    it('should round quantities to 4 decimal places', () => {
      // A -> B: qty=3, loss=7% => 100 * 3 * 1.07 = 321
      // Then B -> C: qty=0.333, loss=0.1% => 321 * 0.333 * 1.001 = 106.9233...
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 100)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 3, 7),
        makeBomLine('comp-B', 'comp-C', 0.333, 0.1),
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      const compCQty = getGrossQty(result.grossRequirements, 'comp-C', 0);
      expect(compCQty).toBeDefined();

      // Verify it has at most 4 decimal places
      const decimalPart = compCQty!.toString().split('.')[1] ?? '';
      expect(decimalPart.length).toBeLessThanOrEqual(4);
    });

    it('should handle large quantities without precision loss', () => {
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 1_000_000)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 5, 3),
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      // 1000000 * 5 * 1.03 = 5150000
      expect(getGrossQty(result.grossRequirements, 'comp-B', 0)).toBe(5150000);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Output Structure (AC-10)
  // ────────────────────────────────────────────────────────────────

  describe('Output structure — AC-10', () => {
    it('should return a map of produtoId -> time-phased gross requirements', () => {
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 50), makeDemand(1, 80)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-B', 2),
        makeBomLine('prod-A', 'comp-C', 1),
      ];

      const productTypes = new Map([['prod-A', 'ACABADO']]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      // Verify the output is a ReadonlyMap
      expect(result.grossRequirements).toBeInstanceOf(Map);

      // Verify each entry has TimePhasedDemand[]
      for (const [, demands] of result.grossRequirements) {
        for (const demand of demands) {
          expect(demand.periodStart).toBeInstanceOf(Date);
          expect(demand.periodEnd).toBeInstanceOf(Date);
          expect(typeof demand.quantity).toBe('number');
        }
      }

      // Verify low-level codes are an object with string keys and number values
      for (const [key, value] of Object.entries(result.lowLevelCodes)) {
        expect(typeof key).toBe('string');
        expect(typeof value).toBe('number');
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Complex Scenario — Integration
  // ────────────────────────────────────────────────────────────────

  describe('Complex scenario — multi-product, multi-level, shared components', () => {
    it('should handle a realistic MRP scenario with 2 finished products and shared raw material', () => {
      // Product Alpha (ACABADO):
      //   -> Sub-Assy X (qty=2, loss=3%)
      //     -> Raw Mat M (qty=5, loss=1%)
      //   -> Sub-Assy Y (qty=1, loss=0%)
      //     -> Raw Mat M (qty=3, loss=2%)  <-- M is shared
      //     -> Raw Mat N (qty=4, loss=0%)
      //
      // Product Beta (ACABADO):
      //   -> Sub-Assy Y (qty=3, loss=1%)   <-- Y is shared with Alpha
      //     -> Raw Mat M (qty=3, loss=2%)
      //     -> Raw Mat N (qty=4, loss=0%)
      //
      // MPS: Alpha=100 (week 0), Beta=50 (week 0)

      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['alpha', [makeDemand(0, 100)]],
        ['beta', [makeDemand(0, 50)]],
      ]);

      const bomLines: BomLineInput[] = [
        // Alpha BOM
        makeBomLine('alpha', 'sub-X', 2, 3),
        makeBomLine('alpha', 'sub-Y', 1, 0),
        // Beta BOM
        makeBomLine('beta', 'sub-Y', 3, 1),
        // Sub-X BOM
        makeBomLine('sub-X', 'raw-M', 5, 1),
        // Sub-Y BOM
        makeBomLine('sub-Y', 'raw-M', 3, 2),
        makeBomLine('sub-Y', 'raw-N', 4, 0),
      ];

      const productTypes = new Map([
        ['alpha', 'ACABADO'],
        ['beta', 'ACABADO'],
      ]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      // Low-level codes:
      // alpha=0, beta=0, sub-X=1, sub-Y=1, raw-M=2, raw-N=2
      expect(result.lowLevelCodes['alpha']).toBe(0);
      expect(result.lowLevelCodes['beta']).toBe(0);
      expect(result.lowLevelCodes['sub-X']).toBe(1);
      expect(result.lowLevelCodes['sub-Y']).toBe(1);
      expect(result.lowLevelCodes['raw-M']).toBe(2);
      expect(result.lowLevelCodes['raw-N']).toBe(2);

      // Sub-X gross (from Alpha): 100 * 2 * 1.03 = 206
      expect(getGrossQty(result.grossRequirements, 'sub-X', 0)).toBe(206);

      // Sub-Y gross:
      //   From Alpha: 100 * 1 * 1.00 = 100
      //   From Beta:  50 * 3 * 1.01 = 151.5
      //   Total: 100 + 151.5 = 251.5
      expect(getGrossQty(result.grossRequirements, 'sub-Y', 0)).toBe(251.5);

      // Raw-M gross:
      //   From Sub-X: 206 * 5 * 1.01 = 1040.3
      //   From Sub-Y: 251.5 * 3 * 1.02 = 769.59
      //   Total: 1040.3 + 769.59 = 1809.89
      expect(getGrossQty(result.grossRequirements, 'raw-M', 0)).toBe(1809.89);

      // Raw-N gross:
      //   From Sub-Y: 251.5 * 4 * 1.00 = 1006
      expect(getGrossQty(result.grossRequirements, 'raw-N', 0)).toBe(1006);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // detectCircularReference — direct method test
  // ────────────────────────────────────────────────────────────────

  describe('detectCircularReference — direct method call', () => {
    it('should not throw for an empty adjacency list', () => {
      const adjacencyList = new Map<string, readonly BomLineInput[]>();
      expect(() => service.detectCircularReference(adjacencyList)).not.toThrow();
    });

    it('should not throw for a valid tree', () => {
      const adjacencyList = new Map<string, readonly BomLineInput[]>([
        ['A', [makeBomLine('A', 'B', 1), makeBomLine('A', 'C', 1)]],
        ['B', [makeBomLine('B', 'D', 1)]],
      ]);
      expect(() => service.detectCircularReference(adjacencyList)).not.toThrow();
    });

    it('should throw for a cycle in an isolated subgraph', () => {
      // Main tree: A -> B -> C (valid)
      // Isolated cycle: X -> Y -> X
      const adjacencyList = new Map<string, readonly BomLineInput[]>([
        ['A', [makeBomLine('A', 'B', 1)]],
        ['B', [makeBomLine('B', 'C', 1)]],
        ['X', [makeBomLine('X', 'Y', 1)]],
        ['Y', [makeBomLine('Y', 'X', 1)]],
      ]);
      expect(() => service.detectCircularReference(adjacencyList)).toThrow(
        BadRequestException,
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Multiple finished products with non-overlapping BOMs
  // ────────────────────────────────────────────────────────────────

  describe('Multiple finished products with separate BOMs', () => {
    it('should process independent BOM trees without interference', () => {
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 100)]],
        ['prod-B', [makeDemand(0, 200)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-X', 2),
        makeBomLine('prod-B', 'comp-Y', 3),
      ];

      const productTypes = new Map([
        ['prod-A', 'ACABADO'],
        ['prod-B', 'ACABADO'],
      ]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      expect(getGrossQty(result.grossRequirements, 'comp-X', 0)).toBe(200);
      expect(getGrossQty(result.grossRequirements, 'comp-Y', 0)).toBe(600);

      // Ensure no cross-contamination
      expect(result.grossRequirements.get('comp-X')?.length).toBe(1);
      expect(result.grossRequirements.get('comp-Y')?.length).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Non-ACABADO parent items (edge case for level-0 detection)
  // ────────────────────────────────────────────────────────────────

  describe('Non-ACABADO parent items in BOM', () => {
    it('should handle parents that are not children of any other item as roots', () => {
      // Scenario: SEMI_ACABADO item that is a parent but not a child of anything
      // and is in the MPS (e.g., a semi-finished product sold independently)
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['semi-A', [makeDemand(0, 50)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('semi-A', 'comp-B', 4),
      ];

      const productTypes = new Map([
        ['semi-A', 'SEMI_ACABADO'],
      ]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      // semi-A should be at level 0 (it's a root — no parent)
      expect(result.lowLevelCodes['semi-A']).toBe(0);
      expect(result.lowLevelCodes['comp-B']).toBe(1);
      expect(getGrossQty(result.grossRequirements, 'comp-B', 0)).toBe(200);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Shared component with different periods from different parents
  // ────────────────────────────────────────────────────────────────

  describe('Shared component with non-overlapping periods', () => {
    it('should handle shared component when parents have demands in different periods', () => {
      // Parent A has demand in week 0, Parent B has demand in week 1
      // Both use component X
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 100)]],
        ['prod-B', [makeDemand(1, 200)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-X', 2),
        makeBomLine('prod-B', 'comp-X', 3),
      ];

      const productTypes = new Map([
        ['prod-A', 'ACABADO'],
        ['prod-B', 'ACABADO'],
      ]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      // comp-X week 0: from A = 100*2=200
      expect(getGrossQty(result.grossRequirements, 'comp-X', 0)).toBe(200);
      // comp-X week 1: from B = 200*3=600
      expect(getGrossQty(result.grossRequirements, 'comp-X', 1)).toBe(600);
    });

    it('should sum when parents have demands in the SAME period for a shared component', () => {
      const mpsRequirements = new Map<string, TimePhasedDemand[]>([
        ['prod-A', [makeDemand(0, 100)]],
        ['prod-B', [makeDemand(0, 200)]],
      ]);

      const bomLines: BomLineInput[] = [
        makeBomLine('prod-A', 'comp-X', 2),
        makeBomLine('prod-B', 'comp-X', 3),
      ];

      const productTypes = new Map([
        ['prod-A', 'ACABADO'],
        ['prod-B', 'ACABADO'],
      ]);

      const input = makeInput({ mpsRequirements, bomLines, productTypes });
      const result = service.explode(input);

      // comp-X week 0: from A = 100*2=200, from B = 200*3=600
      // Total = 800
      expect(getGrossQty(result.grossRequirements, 'comp-X', 0)).toBe(800);
    });
  });
});
