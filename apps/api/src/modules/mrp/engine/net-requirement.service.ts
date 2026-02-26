import { Injectable } from '@nestjs/common';

import type {
  MrpGridRow,
  MrpPeriodBucket,
  NetRequirementInput,
} from './interfaces/mrp-grid.interface';

/**
 * NetRequirementService — Pure Calculation Engine
 *
 * Implements the MRP net requirement formula (FR-049):
 *   netRequirement[t] = MAX(0, grossRequirement[t] - projectedStock[t-1]
 *                            - scheduledReceipts[t] + safetyStock)
 *
 *   projectedStock[t] = projectedStock[t-1] + scheduledReceipts[t]
 *                        - grossRequirement[t] + plannedOrderReceipts[t]
 *
 * Key design decisions:
 *   - AC-9: Pure calculation service — no side effects, no database writes.
 *   - AC-3: Net requirement is floored to 0 (excess carries forward as projected stock).
 *   - AC-5: Safety stock acts as lower bound for projected stock.
 *   - plannedOrderReceipts is always 0 at this stage (filled by lot-sizing in Story 3.5).
 *
 * @see Story 3.2 — Net Requirement Calculation Engine
 */
@Injectable()
export class NetRequirementService {
  private static readonly DECIMAL_PLACES = 4;
  private static readonly ROUNDING_FACTOR = Math.pow(10, NetRequirementService.DECIMAL_PLACES);

  /**
   * Calculate net requirements for a single SKU across all planning periods.
   *
   * @param input - Product data including initial stock, safety stock, and period demands
   * @returns MRP grid row with calculated buckets for each period
   */
  calculateNetRequirements(input: NetRequirementInput): MrpGridRow {
    const periods: MrpPeriodBucket[] = [];
    let projectedStock = input.initialStock;

    for (const period of input.periods) {
      const bucket = this.calculatePeriodBucket(
        period.periodStart,
        period.periodEnd,
        period.grossRequirement,
        period.scheduledReceipts,
        projectedStock,
        input.safetyStock,
      );

      periods.push(bucket);
      projectedStock = bucket.projectedStock;
    }

    return {
      produtoId: input.produtoId,
      periods,
    };
  }

  /**
   * Calculate the MRP bucket for a single period.
   *
   * Formula:
   *   1. netBeforeFloor = gross - previousProjectedStock - scheduled + safetyStock
   *   2. netRequirement = MAX(0, netBeforeFloor)
   *   3. projectedStock = previousProjectedStock + scheduled - gross + plannedOrderReceipts
   *   4. Safety stock check: if projectedStock < safetyStock AND netRequirement == 0,
   *      then netRequirement = safetyStock - projectedStock
   */
  private calculatePeriodBucket(
    periodStart: Date,
    periodEnd: Date,
    grossRequirement: number,
    scheduledReceipts: number,
    previousProjectedStock: number,
    safetyStock: number,
  ): MrpPeriodBucket {
    // Step 1: Calculate net requirement from formula (AC-1)
    const netBeforeFloor =
      grossRequirement - previousProjectedStock - scheduledReceipts + safetyStock;

    // Step 2: Floor to 0 — excess carries forward as projected stock (AC-3)
    const netRequirement = Math.max(0, this.round(netBeforeFloor));

    // Step 3: Calculate projected stock at end of period (AC-4)
    // plannedOrderReceipts is always 0 at this stage
    const plannedOrderReceipts = 0;
    const projectedStock = this.round(
      previousProjectedStock + scheduledReceipts - grossRequirement + plannedOrderReceipts,
    );

    // Step 4: Safety stock check (AC-5)
    // If projected stock drops below safety stock and no net requirement was generated,
    // generate net requirement to bring projected stock back to safety stock level
    let finalNetRequirement = netRequirement;
    if (projectedStock < safetyStock && netRequirement === 0) {
      finalNetRequirement = this.round(safetyStock - projectedStock);
    }

    return {
      periodStart,
      periodEnd,
      grossRequirement,
      scheduledReceipts,
      projectedStock,
      netRequirement: finalNetRequirement,
      plannedOrderReceipts,
    };
  }

  /**
   * Round to DECIMAL_PLACES to avoid floating-point precision issues.
   * Uses factor-based rounding for deterministic results.
   */
  private round(value: number): number {
    return (
      Math.round(value * NetRequirementService.ROUNDING_FACTOR) /
      NetRequirementService.ROUNDING_FACTOR
    );
  }
}
