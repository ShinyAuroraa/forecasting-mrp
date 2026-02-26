import { BadRequestException, Injectable } from '@nestjs/common';

import type {
  BomExplosionInput,
  BomExplosionResult,
  BomLineInput,
  LowLevelCodeMap,
  TimePhasedDemand,
} from './interfaces/bom-explosion.interface';

/**
 * BomExplosionService — Pure Calculation Engine for Multi-Level BOM Explosion
 *
 * Implements the MRP BOM explosion process (FR-036):
 *   1. Assign low-level codes to all items in the BOM hierarchy
 *   2. Process level by level (0, 1, 2, ...) cascading gross requirements
 *   3. For each parent item, explode planned quantities to children using BOM quantities
 *   4. Apply loss percentages: childGross = parentQty * bom.quantidade * (1 + perdaPercentual/100)
 *   5. Sum requirements from multiple parents for shared components
 *
 * Key design decisions:
 *   - AC-2: Level 0 = finished products (tipoProduto = ACABADO)
 *   - AC-3: Items at multiple levels get the HIGHEST level number (deepest)
 *   - AC-6: Loss percentage applied as multiplier (1 + perdaPercentual / 100)
 *   - AC-8: Shared components sum all parent requirements
 *   - AC-9: Circular references detected and reported as BadRequestException
 *   - Pure calculation service — no side effects, no database access
 *
 * @see Story 3.4 — Multi-Level BOM Explosion
 * @see FR-036 — BOM Explosion
 */
@Injectable()
export class BomExplosionService {
  private static readonly DECIMAL_PLACES = 4;
  private static readonly ROUNDING_FACTOR = Math.pow(10, BomExplosionService.DECIMAL_PLACES);

  /** DFS node coloring for cycle detection */
  private static readonly WHITE = 0;
  private static readonly GRAY = 1;
  private static readonly BLACK = 2;

  /**
   * Execute multi-level BOM explosion.
   *
   * @param input - Pre-fetched BOM data, MPS requirements, and product types
   * @returns Low-level codes and cascaded gross requirements for all items
   */
  explode(input: BomExplosionInput): BomExplosionResult {
    const { mpsRequirements, bomLines, productTypes } = input;

    // Step 1: Build adjacency list from BOM lines (parent -> children)
    const adjacencyList = this.buildAdjacencyList(bomLines);

    // Step 2: Detect circular references before processing
    this.detectCircularReference(adjacencyList);

    // Step 3: Compute low-level codes for all items
    const lowLevelCodes = this.assignLowLevelCodes(bomLines, productTypes);

    // Step 4: Find the maximum level
    const maxLevel = Object.values(lowLevelCodes).reduce(
      (max, level) => Math.max(max, level),
      0,
    );

    // Step 5: Initialize gross requirements from MPS for level-0 items
    const grossRequirements = new Map<string, TimePhasedDemand[]>();

    for (const [produtoId, demands] of mpsRequirements) {
      grossRequirements.set(
        produtoId,
        demands.map((d) => ({ ...d })),
      );
    }

    // Step 6: Process level by level from 0 to maxLevel
    for (let level = 0; level <= maxLevel; level++) {
      this.explodeLevel(level, lowLevelCodes, adjacencyList, grossRequirements);
    }

    // Step 7: Build immutable result
    const immutableGrossRequirements = new Map<string, readonly TimePhasedDemand[]>();
    for (const [produtoId, demands] of grossRequirements) {
      immutableGrossRequirements.set(produtoId, Object.freeze([...demands]));
    }

    return {
      lowLevelCodes: { ...lowLevelCodes },
      grossRequirements: immutableGrossRequirements,
    };
  }

  /**
   * Build an adjacency list from BOM lines.
   * Maps each parent to its list of BOM line inputs (children with quantities).
   *
   * @param bomLines - Active BOM lines
   * @returns Adjacency list: parentId -> BomLineInput[]
   */
  private buildAdjacencyList(
    bomLines: readonly BomLineInput[],
  ): ReadonlyMap<string, readonly BomLineInput[]> {
    const adjacency = new Map<string, BomLineInput[]>();

    for (const line of bomLines) {
      const existing = adjacency.get(line.produtoPaiId);
      if (existing) {
        existing.push(line);
      } else {
        adjacency.set(line.produtoPaiId, [line]);
      }
    }

    return adjacency;
  }

  /**
   * Assign low-level codes to all items in the BOM hierarchy.
   *
   * Algorithm:
   *   1. All products with tipoProduto = ACABADO start at level 0
   *   2. DFS traversal from each level-0 item to find maximum depth per item
   *   3. If an item appears at multiple levels, it gets the HIGHEST level number (AC-3)
   *
   * @param bomLines - Active BOM lines
   * @param productTypes - Product types for level-0 identification
   * @returns Map of produtoId -> low-level code
   */
  assignLowLevelCodes(
    bomLines: readonly BomLineInput[],
    productTypes: ReadonlyMap<string, string>,
  ): LowLevelCodeMap {
    const adjacency = this.buildAdjacencyList(bomLines);
    const levelCodes: Record<string, number> = {};

    // Identify level-0 items: finished products (ACABADO)
    const rootItems: string[] = [];
    for (const [produtoId, type] of productTypes) {
      if (type === 'ACABADO') {
        rootItems.push(produtoId);
      }
    }

    // Also consider any parent that is not a child of another parent
    // and is not already a root item (handles edge cases)
    const allChildren = new Set<string>();
    const allParents = new Set<string>();
    for (const line of bomLines) {
      allChildren.add(line.produtoFilhoId);
      allParents.add(line.produtoPaiId);
    }

    for (const parentId of allParents) {
      if (!allChildren.has(parentId) && !rootItems.includes(parentId)) {
        rootItems.push(parentId);
      }
    }

    // DFS from each root to assign maximum depth
    for (const rootId of rootItems) {
      this.dfsAssignLevels(rootId, 0, adjacency, levelCodes);
    }

    // Ensure root items are included even if they have no BOM children
    for (const rootId of rootItems) {
      if (levelCodes[rootId] === undefined) {
        levelCodes[rootId] = 0;
      }
    }

    return levelCodes;
  }

  /**
   * DFS traversal to assign low-level codes.
   * Each item gets the HIGHEST level number found across all paths (AC-3).
   *
   * @param itemId - Current item being processed
   * @param currentLevel - Current depth in the BOM hierarchy
   * @param adjacency - Adjacency list (parent -> children)
   * @param levelCodes - Mutable map being built
   */
  private dfsAssignLevels(
    itemId: string,
    currentLevel: number,
    adjacency: ReadonlyMap<string, readonly BomLineInput[]>,
    levelCodes: Record<string, number>,
  ): void {
    // Assign the maximum level found for this item (AC-3)
    const existingLevel = levelCodes[itemId];
    if (existingLevel === undefined || currentLevel > existingLevel) {
      levelCodes[itemId] = currentLevel;
    }

    // Traverse children
    const children = adjacency.get(itemId);
    if (!children) {
      return; // Leaf node — no children
    }

    for (const child of children) {
      this.dfsAssignLevels(
        child.produtoFilhoId,
        currentLevel + 1,
        adjacency,
        levelCodes,
      );
    }
  }

  /**
   * Detect circular references in the BOM hierarchy.
   * Uses standard DFS with WHITE/GRAY/BLACK coloring.
   *
   * @param adjacencyList - Adjacency list (parent -> children)
   * @throws BadRequestException if a cycle is detected
   */
  detectCircularReference(
    adjacencyList: ReadonlyMap<string, readonly BomLineInput[]>,
  ): void {
    const color = new Map<string, number>();

    // Collect all unique nodes
    const allNodes = new Set<string>();
    for (const [parentId, children] of adjacencyList) {
      allNodes.add(parentId);
      for (const child of children) {
        allNodes.add(child.produtoFilhoId);
      }
    }

    // Initialize all nodes as WHITE (unvisited)
    for (const nodeId of allNodes) {
      color.set(nodeId, BomExplosionService.WHITE);
    }

    // Run DFS from each unvisited node
    for (const nodeId of allNodes) {
      if (color.get(nodeId) === BomExplosionService.WHITE) {
        this.dfsDetectCycle(nodeId, adjacencyList, color, []);
      }
    }
  }

  /**
   * DFS helper for cycle detection.
   *
   * @param nodeId - Current node
   * @param adjacencyList - Adjacency list
   * @param color - Node coloring map (WHITE=unvisited, GRAY=in-progress, BLACK=done)
   * @param path - Current DFS path for error reporting
   * @throws BadRequestException if a back edge (cycle) is detected
   */
  private dfsDetectCycle(
    nodeId: string,
    adjacencyList: ReadonlyMap<string, readonly BomLineInput[]>,
    color: Map<string, number>,
    path: string[],
  ): void {
    color.set(nodeId, BomExplosionService.GRAY);
    const currentPath = [...path, nodeId];

    const children = adjacencyList.get(nodeId);
    if (children) {
      for (const child of children) {
        const childColor = color.get(child.produtoFilhoId);

        if (childColor === BomExplosionService.GRAY) {
          // Back edge found — circular reference detected
          const cyclePath = [...currentPath, child.produtoFilhoId];
          const cycleStart = cyclePath.indexOf(child.produtoFilhoId);
          const cycleNodes = cyclePath.slice(cycleStart);

          throw new BadRequestException(
            `Circular BOM reference detected: ${cycleNodes.join(' -> ')}`,
          );
        }

        if (childColor === BomExplosionService.WHITE) {
          this.dfsDetectCycle(child.produtoFilhoId, adjacencyList, color, currentPath);
        }
      }
    }

    color.set(nodeId, BomExplosionService.BLACK);
  }

  /**
   * Explode a single level of the BOM hierarchy.
   *
   * For each item at the given level:
   *   1. Get its gross requirements
   *   2. For each child in BOM: accumulate childGross += parentGross * quantidade * (1 + perdaPercentual/100)
   *   3. Shared components (AC-8) naturally sum via the accumulation pattern
   *
   * @param level - Current level being processed
   * @param lowLevelCodes - Low-level code assignments
   * @param adjacencyList - Adjacency list (parent -> children)
   * @param grossRequirements - Mutable map of accumulated gross requirements
   */
  private explodeLevel(
    level: number,
    lowLevelCodes: LowLevelCodeMap,
    adjacencyList: ReadonlyMap<string, readonly BomLineInput[]>,
    grossRequirements: Map<string, TimePhasedDemand[]>,
  ): void {
    // Find all items at this level
    const itemsAtLevel: string[] = [];
    for (const [produtoId, itemLevel] of Object.entries(lowLevelCodes)) {
      if (itemLevel === level) {
        itemsAtLevel.push(produtoId);
      }
    }

    // For each item at this level, explode to children
    for (const parentId of itemsAtLevel) {
      const parentDemands = grossRequirements.get(parentId);
      if (!parentDemands || parentDemands.length === 0) {
        continue; // No demand for this parent — skip
      }

      const children = adjacencyList.get(parentId);
      if (!children) {
        continue; // Leaf node — no children to explode to
      }

      // Explode to each child
      for (const bomLine of children) {
        const childId = bomLine.produtoFilhoId;
        const lossMultiplier = 1 + bomLine.perdaPercentual / 100;

        // Calculate child gross requirements from parent demands
        const childDemands: TimePhasedDemand[] = parentDemands.map((parentDemand) => ({
          periodStart: parentDemand.periodStart,
          periodEnd: parentDemand.periodEnd,
          quantity: this.round(parentDemand.quantity * bomLine.quantidade * lossMultiplier),
        }));

        // Accumulate into existing child requirements (AC-8: shared components)
        const existingChildDemands = grossRequirements.get(childId);
        if (existingChildDemands) {
          this.mergeDemands(existingChildDemands, childDemands);
        } else {
          grossRequirements.set(childId, childDemands);
        }
      }
    }
  }

  /**
   * Merge new demands into existing demands by matching periods.
   * If periods match (same periodStart), quantities are summed.
   * If a period is new, it is appended.
   *
   * @param existing - Existing demand array (mutated in place)
   * @param incoming - New demands to merge
   */
  private mergeDemands(
    existing: TimePhasedDemand[],
    incoming: readonly TimePhasedDemand[],
  ): void {
    for (const newDemand of incoming) {
      const matchIndex = existing.findIndex(
        (e) => e.periodStart.getTime() === newDemand.periodStart.getTime(),
      );

      if (matchIndex >= 0) {
        // Sum quantities for the same period (AC-8)
        const matched = existing[matchIndex];
        existing[matchIndex] = {
          periodStart: matched.periodStart,
          periodEnd: matched.periodEnd,
          quantity: this.round(matched.quantity + newDemand.quantity),
        };
      } else {
        existing.push({ ...newDemand });
      }
    }
  }

  /**
   * Round to DECIMAL_PLACES to avoid floating-point precision issues.
   * Uses factor-based rounding for deterministic results.
   */
  private round(value: number): number {
    return (
      Math.round(value * BomExplosionService.ROUNDING_FACTOR) /
      BomExplosionService.ROUNDING_FACTOR
    );
  }
}
