import { BadRequestException, Injectable } from '@nestjs/common';

import type {
  LotSizingInput,
  LotSizingOutput,
  LotSizingPeriod,
  PlannedOrder,
} from './interfaces/lot-sizing.interface';

/**
 * LotSizingService — Pure Calculation Engine
 *
 * Determines planned order quantities from net requirements using one of
 * four lot sizing methods: Lot-for-Lot (L4L), Economic Order Quantity (EOQ),
 * Silver-Meal heuristic, or Wagner-Whitin optimal (dynamic programming).
 *
 * After computing raw planned quantities, applies purchasing constraints in
 * strict order: (1) lote_minimo, (2) multiplo_compra roundup, (3) MOQ.
 *
 * Generates both planned order receipts (in the period of need) and planned
 * order releases (offset back by lead time). Releases falling before the
 * planning horizon are flagged as past-due.
 *
 * Key design decisions:
 *   - AC-1: Accepts net requirements array + method, returns planned orders
 *   - AC-2: L4L — planned qty = net requirement per period (no aggregation)
 *   - AC-3: EOQ — order EOQ-sized lots, skip periods covered by prior order
 *   - AC-4: Silver-Meal — aggregate while average cost per period decreases
 *   - AC-5/6: Constraints applied in order: loteMinimo -> multiploCompra -> MOQ
 *   - AC-7: Receipt at period of need, release offset back by leadTimePeriods
 *   - AC-8: Returns both receipts and releases as time-phased arrays
 *   - Pure calculation — no side effects, no database access
 *
 * @see Story 3.5 — Lot Sizing Engine
 * @see FR-037 — Lot Sizing Methods
 */
@Injectable()
export class LotSizingService {
  private static readonly DECIMAL_PLACES = 4;
  private static readonly ROUNDING_FACTOR = Math.pow(10, LotSizingService.DECIMAL_PLACES);

  /**
   * Calculate lot sizing for a single SKU across all planning periods.
   *
   * Routes to the appropriate method-specific calculation based on input.method,
   * then applies lead time offsetting to generate planned order releases.
   *
   * @param input - Pre-fetched lot sizing parameters including net requirements
   * @returns Planned order receipts, releases, and past-due releases
   * @throws BadRequestException if an unsupported method is provided
   */
  calculateLotSizing(input: LotSizingInput): LotSizingOutput {
    const receipts = this.calculateReceipts(input);
    const { releases, pastDue } = this.offsetByLeadTime(
      receipts,
      input.netRequirements,
      input.leadTimePeriods,
    );

    return {
      produtoId: input.produtoId,
      plannedOrderReceipts: receipts,
      plannedOrderReleases: releases,
      pastDueReleases: pastDue,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Method Routing
  // ────────────────────────────────────────────────────────────────

  /**
   * Route to the correct lot sizing method and compute planned order receipts.
   */
  private calculateReceipts(input: LotSizingInput): readonly PlannedOrder[] {
    switch (input.method) {
      case 'L4L':
        return this.calculateL4L(input);
      case 'EOQ':
        return this.calculateEOQ(input);
      case 'SILVER_MEAL':
        return this.calculateSilverMeal(input);
      case 'WAGNER_WHITIN':
        return this.calculateWagnerWhitin(input);
      default:
        throw new BadRequestException(
          `Unsupported lot sizing method: "${input.method as string}". ` +
          'Supported methods are: L4L, EOQ, SILVER_MEAL, WAGNER_WHITIN.',
        );
    }
  }

  // ────────────────────────────────────────────────────────────────
  // L4L — Lot-for-Lot (AC-2)
  // ────────────────────────────────────────────────────────────────

  /**
   * Lot-for-Lot: planned order quantity = net requirement for each period.
   * No aggregation — each period with a positive net requirement receives
   * its own planned order (after constraint application).
   */
  private calculateL4L(input: LotSizingInput): readonly PlannedOrder[] {
    const receipts: PlannedOrder[] = [];

    for (let i = 0; i < input.netRequirements.length; i++) {
      const period = input.netRequirements[i];

      if (period.quantity > 0) {
        const plannedQty = this.applyConstraints(
          period.quantity,
          input.loteMinimo,
          input.multiploCompra,
          input.moq,
        );

        receipts.push({
          periodIndex: i,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          quantity: plannedQty,
        });
      }
    }

    return receipts;
  }

  // ────────────────────────────────────────────────────────────────
  // EOQ — Economic Order Quantity (AC-3)
  // ────────────────────────────────────────────────────────────────

  /**
   * EOQ method: order in EOQ-sized lots when net requirement > 0.
   * If the EOQ covers multiple periods, no new orders are placed until
   * the accumulated coverage is depleted.
   *
   * When eoqValue is 0 or negative, falls back to L4L behavior
   * (order exactly the deficit after constraints).
   */
  private calculateEOQ(input: LotSizingInput): readonly PlannedOrder[] {
    const receipts: PlannedOrder[] = [];
    let accumulatedCoverage = 0;

    for (let i = 0; i < input.netRequirements.length; i++) {
      const period = input.netRequirements[i];

      if (period.quantity > 0) {
        if (accumulatedCoverage >= period.quantity) {
          // Covered by a previous EOQ order — no new order needed
          accumulatedCoverage = this.round(accumulatedCoverage - period.quantity);
        } else {
          // Need a new order
          const deficit = this.round(period.quantity - accumulatedCoverage);
          const rawOrderQty = input.eoqValue > 0
            ? Math.max(input.eoqValue, deficit)
            : deficit;
          const orderQty = this.applyConstraints(
            rawOrderQty,
            input.loteMinimo,
            input.multiploCompra,
            input.moq,
          );

          accumulatedCoverage = this.round(orderQty - deficit);

          receipts.push({
            periodIndex: i,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            quantity: orderQty,
          });
        }
      }
    }

    return receipts;
  }

  // ────────────────────────────────────────────────────────────────
  // Silver-Meal Heuristic (AC-4)
  // ────────────────────────────────────────────────────────────────

  /**
   * Silver-Meal heuristic: aggregate future periods into the current order
   * as long as the average cost per period decreases.
   *
   * Cost model:
   *   - Each order incurs a fixed ordering cost K
   *   - Carrying inventory incurs holdingCostPerUnit * quantity * periodsHeld
   *   - Average cost = totalCost / periodsCovered
   *
   * Zero-demand periods are skipped in cost calculation but count toward
   * period distance for holding cost computation.
   */
  private calculateSilverMeal(input: LotSizingInput): readonly PlannedOrder[] {
    const receipts: PlannedOrder[] = [];
    const periods = input.netRequirements;
    let i = 0;

    while (i < periods.length) {
      if (periods[i].quantity <= 0) {
        i++;
        continue;
      }

      // Start a new order at period i
      let totalCost = input.orderingCost; // K
      let accumQty = periods[i].quantity;
      let periodsCovered = 1;
      let bestAvgCost = totalCost / periodsCovered;

      let j = i + 1;
      let bestJ = j; // tracks where to stop aggregation

      while (j < periods.length) {
        if (periods[j].quantity <= 0) {
          j++;
          continue;
        }

        // Holding cost for carrying periods[j].quantity from period i to period j
        const holdingIncrement = input.holdingCostPerUnit * periods[j].quantity * (j - i);
        totalCost = this.round(totalCost + holdingIncrement);
        const newAvgCost = this.round(totalCost / (periodsCovered + 1));

        if (newAvgCost < bestAvgCost) {
          bestAvgCost = newAvgCost;
          accumQty = this.round(accumQty + periods[j].quantity);
          periodsCovered++;
          j++;
          bestJ = j;
        } else {
          break;
        }
      }

      const plannedQty = this.applyConstraints(
        accumQty,
        input.loteMinimo,
        input.multiploCompra,
        input.moq,
      );

      receipts.push({
        periodIndex: i,
        periodStart: periods[i].periodStart,
        periodEnd: periods[i].periodEnd,
        quantity: plannedQty,
      });

      // Skip to the next uncovered period
      i = bestJ;
    }

    return receipts;
  }

  // ────────────────────────────────────────────────────────────────
  // Wagner-Whitin — Optimal Dynamic Programming (Story 5.1)
  // ────────────────────────────────────────────────────────────────

  /**
   * Wagner-Whitin optimal lot sizing via dynamic programming.
   *
   * Minimizes total cost (ordering K + holding h) over the planning horizon.
   * Produces the globally optimal solution (unlike Silver-Meal which is a heuristic).
   *
   * Key property: in an optimal solution, orders are only placed in periods
   * where beginning inventory = 0 (zero-inventory ordering property).
   *
   * DP recurrence:
   *   dp[j] = min over all i<=j { dp[i-1] + K + Σ_{k=i}^{j} h·demand[k]·(k-i) }
   *   where dp[-1] = 0 (base case)
   *
   * Time complexity: O(m²) where m = number of periods with positive demand.
   * Space complexity: O(m) for dp table and backtrack array.
   *
   * @see Story 5.1 — Wagner-Whitin Optimal Lot Sizing
   * @see FR-064 — Wagner-Whitin Lot Sizing
   */
  private calculateWagnerWhitin(input: LotSizingInput): readonly PlannedOrder[] {
    // Extract only periods with positive demand (preserving original indices)
    const demandPeriods: { readonly originalIndex: number; readonly period: LotSizingPeriod }[] = [];
    for (let idx = 0; idx < input.netRequirements.length; idx++) {
      if (input.netRequirements[idx].quantity > 0) {
        demandPeriods.push({ originalIndex: idx, period: input.netRequirements[idx] });
      }
    }

    if (demandPeriods.length === 0) {
      return [];
    }

    const m = demandPeriods.length;
    const K = input.orderingCost;
    const h = input.holdingCostPerUnit;

    // dp[j] = minimum total cost to cover demand periods 0..j
    const dp: number[] = new Array(m).fill(Infinity);
    // backtrack[j] = the period i at which the last order was placed to cover up to j
    const backtrack: number[] = new Array(m).fill(0);

    for (let j = 0; j < m; j++) {
      // Try placing an order at demand period i to cover demands i..j.
      // Iterate i from j down to 0 with incremental holding cost update:
      // when order point moves from i+1 to i, all demands in [i+1..j]
      // are held for additional (originalIndex[i+1] - originalIndex[i]) periods.
      let holdingCost = 0;
      let demandSum = 0;

      for (let i = j; i >= 0; i--) {
        if (i < j) {
          const gapPeriods = demandPeriods[i + 1].originalIndex - demandPeriods[i].originalIndex;
          holdingCost = this.round(holdingCost + h * demandSum * gapPeriods);
        }
        demandSum = this.round(demandSum + demandPeriods[i].period.quantity);

        const prevCost = i > 0 ? dp[i - 1] : 0;
        const totalCost = this.round(prevCost + K + holdingCost);

        if (totalCost < dp[j]) {
          dp[j] = totalCost;
          backtrack[j] = i;
        }
      }
    }

    // Backtrace to find order placement periods and quantities
    const orders: { demandStart: number; demandEnd: number }[] = [];
    let j = m - 1;
    while (j >= 0) {
      const i = backtrack[j];
      orders.push({ demandStart: i, demandEnd: j });
      j = i - 1;
    }
    orders.reverse();

    // Build planned order receipts
    const receipts: PlannedOrder[] = [];
    for (const order of orders) {
      let accumQty = 0;
      for (let k = order.demandStart; k <= order.demandEnd; k++) {
        accumQty = this.round(accumQty + demandPeriods[k].period.quantity);
      }

      const plannedQty = this.applyConstraints(
        accumQty,
        input.loteMinimo,
        input.multiploCompra,
        input.moq,
      );

      const orderPeriod = demandPeriods[order.demandStart];
      receipts.push({
        periodIndex: orderPeriod.originalIndex,
        periodStart: orderPeriod.period.periodStart,
        periodEnd: orderPeriod.period.periodEnd,
        quantity: plannedQty,
      });
    }

    return receipts;
  }

  // ────────────────────────────────────────────────────────────────
  // Constraint Application (AC-5, AC-6)
  // ────────────────────────────────────────────────────────────────

  /**
   * Apply purchasing constraints in strict order:
   *   1. lote_minimo — if qty > 0 and qty < loteMinimo, round up to loteMinimo
   *   2. multiplo_compra — round up to nearest multiple
   *   3. MOQ — if qty < MOQ, round up to MOQ
   *
   * @param qty - Raw planned order quantity
   * @param loteMinimo - Minimum lot size (Produto.loteMinimo)
   * @param multiploCompra - Purchase multiple (Produto.multiploCompra)
   * @param moq - Minimum Order Quantity (ProdutoFornecedor.moq)
   * @returns Constrained and rounded order quantity
   */
  applyConstraints(
    qty: number,
    loteMinimo: number,
    multiploCompra: number,
    moq: number,
  ): number {
    let result = qty;

    // Step 1: lote_minimo
    if (result > 0 && result < loteMinimo) {
      result = loteMinimo;
    }

    // Step 2: multiplo_compra (round up to nearest multiple)
    if (multiploCompra > 1) {
      result = Math.ceil(result / multiploCompra) * multiploCompra;
    }

    // Step 3: MOQ from supplier
    if (moq > 1 && result < moq) {
      result = moq;
    }

    return this.round(result);
  }

  // ────────────────────────────────────────────────────────────────
  // Lead Time Offsetting (AC-7)
  // ────────────────────────────────────────────────────────────────

  /**
   * Offset planned order receipts back by lead time to generate planned
   * order releases. If a release falls before the planning horizon
   * (negative period index), it is flagged as past-due.
   *
   * @param receipts - Planned order receipts at the period of need
   * @param periods - The full array of planning periods (for date lookup)
   * @param leadTimePeriods - Number of periods to offset back
   * @returns Object containing releases and past-due releases
   */
  private offsetByLeadTime(
    receipts: readonly PlannedOrder[],
    periods: readonly LotSizingPeriod[],
    leadTimePeriods: number,
  ): { readonly releases: readonly PlannedOrder[]; readonly pastDue: readonly PlannedOrder[] } {
    const releases: PlannedOrder[] = [];
    const pastDue: PlannedOrder[] = [];

    for (const receipt of receipts) {
      const releaseIndex = receipt.periodIndex - leadTimePeriods;

      if (releaseIndex >= 0 && releaseIndex < periods.length) {
        releases.push({
          periodIndex: releaseIndex,
          periodStart: periods[releaseIndex].periodStart,
          periodEnd: periods[releaseIndex].periodEnd,
          quantity: receipt.quantity,
        });
      } else if (releaseIndex < 0) {
        // Past-due: release date falls before the planning horizon
        pastDue.push({
          periodIndex: releaseIndex,
          periodStart: receipt.periodStart,
          periodEnd: receipt.periodEnd,
          quantity: receipt.quantity,
        });
      }
    }

    return { releases, pastDue };
  }

  // ────────────────────────────────────────────────────────────────
  // Internal Helpers
  // ────────────────────────────────────────────────────────────────

  /**
   * Round to DECIMAL_PLACES to avoid floating-point precision issues.
   * Uses factor-based rounding for deterministic results.
   */
  private round(value: number): number {
    return (
      Math.round(value * LotSizingService.ROUNDING_FACTOR) /
      LotSizingService.ROUNDING_FACTOR
    );
  }
}
