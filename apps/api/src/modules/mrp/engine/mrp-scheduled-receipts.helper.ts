import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

/**
 * MrpScheduledReceiptsHelper — Database Reader for Scheduled Receipts
 *
 * Reads scheduled receipt data from OrdemPlanejada to prepare input
 * for the NetRequirementService pure calculation.
 *
 * Scheduled receipts are orders with status FIRME or LIBERADA whose
 * expected receipt date falls within the planning period (AC-8).
 *
 * This helper is called by the MRP orchestrator (Story 3.10) to gather data
 * before passing it to NetRequirementService.calculateNetRequirements().
 *
 * @see Story 3.2 — Net Requirement Calculation Engine (AC-8)
 */
@Injectable()
export class MrpScheduledReceiptsHelper {
  private static readonly RECEIPT_STATUSES = ['FIRME', 'LIBERADA'] as const;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get total scheduled receipts for a single product within a date range.
   * Only counts orders with status FIRME or LIBERADA.
   *
   * @param produtoId - The product identifier
   * @param periodStart - Start of the period (inclusive)
   * @param periodEnd - End of the period (inclusive)
   * @returns Total quantity of scheduled receipts in the period
   */
  async getScheduledReceipts(
    produtoId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<number> {
    const result = await this.prisma.ordemPlanejada.aggregate({
      where: {
        produtoId,
        status: { in: [...MrpScheduledReceiptsHelper.RECEIPT_STATUSES] },
        dataRecebimentoEsperado: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      _sum: {
        quantidade: true,
      },
    });

    return Number(result._sum.quantidade ?? 0);
  }

  /**
   * Get scheduled receipts for a single product across multiple periods in one query.
   * Returns a map from period index to total scheduled receipt quantity.
   *
   * More efficient than calling getScheduledReceipts() for each period individually,
   * as it fetches all relevant orders in a single query and distributes them.
   *
   * @param produtoId - The product identifier
   * @param periods - Array of { periodStart, periodEnd } defining the time buckets
   * @returns Map from period index to total scheduled receipt quantity
   */
  async getScheduledReceiptsForPeriods(
    produtoId: string,
    periods: readonly { readonly periodStart: Date; readonly periodEnd: Date }[],
  ): Promise<Map<number, number>> {
    if (periods.length === 0) {
      return new Map();
    }

    // Find the overall date range to minimize the query scope
    const overallStart = periods[0].periodStart;
    const overallEnd = periods[periods.length - 1].periodEnd;

    const orders = await this.prisma.ordemPlanejada.findMany({
      where: {
        produtoId,
        status: { in: [...MrpScheduledReceiptsHelper.RECEIPT_STATUSES] },
        dataRecebimentoEsperado: {
          gte: overallStart,
          lte: overallEnd,
        },
      },
      select: {
        quantidade: true,
        dataRecebimentoEsperado: true,
      },
    });

    // Distribute orders into their respective period buckets
    const receiptsByPeriod = new Map<number, number>();

    for (let i = 0; i < periods.length; i++) {
      receiptsByPeriod.set(i, 0);
    }

    for (const order of orders) {
      if (order.dataRecebimentoEsperado === null) {
        continue;
      }

      const receiptDate = order.dataRecebimentoEsperado;
      const quantidade = Number(order.quantidade);

      for (let i = 0; i < periods.length; i++) {
        if (receiptDate >= periods[i].periodStart && receiptDate <= periods[i].periodEnd) {
          const current = receiptsByPeriod.get(i) ?? 0;
          receiptsByPeriod.set(i, current + quantidade);
          break; // Each order falls into exactly one period
        }
      }
    }

    return receiptsByPeriod;
  }

  /**
   * Get scheduled receipts for multiple products across multiple periods.
   * Batch version for efficiency when processing many SKUs.
   *
   * @param produtoIds - Array of product identifiers
   * @param periods - Array of { periodStart, periodEnd } defining the time buckets
   * @returns Nested map: produtoId -> periodIndex -> quantity
   */
  async getScheduledReceiptsBatch(
    produtoIds: string[],
    periods: readonly { readonly periodStart: Date; readonly periodEnd: Date }[],
  ): Promise<Map<string, Map<number, number>>> {
    if (produtoIds.length === 0 || periods.length === 0) {
      return new Map();
    }

    const overallStart = periods[0].periodStart;
    const overallEnd = periods[periods.length - 1].periodEnd;

    const orders = await this.prisma.ordemPlanejada.findMany({
      where: {
        produtoId: { in: produtoIds },
        status: { in: [...MrpScheduledReceiptsHelper.RECEIPT_STATUSES] },
        dataRecebimentoEsperado: {
          gte: overallStart,
          lte: overallEnd,
        },
      },
      select: {
        produtoId: true,
        quantidade: true,
        dataRecebimentoEsperado: true,
      },
    });

    // Initialize result map with zeros for all products and periods
    const result = new Map<string, Map<number, number>>();
    for (const produtoId of produtoIds) {
      const periodMap = new Map<number, number>();
      for (let i = 0; i < periods.length; i++) {
        periodMap.set(i, 0);
      }
      result.set(produtoId, periodMap);
    }

    // Distribute orders into their respective product-period buckets
    for (const order of orders) {
      if (order.dataRecebimentoEsperado === null) {
        continue;
      }

      const receiptDate = order.dataRecebimentoEsperado;
      const quantidade = Number(order.quantidade);
      const periodMap = result.get(order.produtoId);

      if (periodMap === undefined) {
        continue;
      }

      for (let i = 0; i < periods.length; i++) {
        if (receiptDate >= periods[i].periodStart && receiptDate <= periods[i].periodEnd) {
          const current = periodMap.get(i) ?? 0;
          periodMap.set(i, current + quantidade);
          break;
        }
      }
    }

    return result;
  }
}
