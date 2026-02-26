import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

/**
 * MrpInventoryHelper — Database Reader for Available Stock
 *
 * Reads current inventory data from InventarioAtual to prepare input
 * for the NetRequirementService pure calculation.
 *
 * Available stock formula (AC-7):
 *   availableStock = SUM(quantidadeDisponivel - quantidadeReservada) across all depositos
 *
 * This helper is called by the MRP orchestrator (Story 3.10) to gather data
 * before passing it to NetRequirementService.calculateNetRequirements().
 *
 * @see Story 3.2 — Net Requirement Calculation Engine (AC-7)
 */
@Injectable()
export class MrpInventoryHelper {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get total available stock for a single product across all depositos.
   *
   * @param produtoId - The product identifier
   * @returns Available stock (quantidadeDisponivel - quantidadeReservada), 0 if no inventory records
   */
  async getAvailableStock(produtoId: string): Promise<number> {
    const result = await this.prisma.inventarioAtual.aggregate({
      where: { produtoId },
      _sum: {
        quantidadeDisponivel: true,
        quantidadeReservada: true,
      },
    });

    const disponivel = Number(result._sum.quantidadeDisponivel ?? 0);
    const reservada = Number(result._sum.quantidadeReservada ?? 0);

    return disponivel - reservada;
  }

  /**
   * Get total available stock for multiple products in a single query.
   * Uses groupBy for efficiency instead of N individual queries.
   *
   * @param produtoIds - Array of product identifiers
   * @returns Map of produtoId to available stock
   */
  async getAvailableStockBatch(produtoIds: string[]): Promise<Map<string, number>> {
    if (produtoIds.length === 0) {
      return new Map();
    }

    const results = await this.prisma.inventarioAtual.groupBy({
      by: ['produtoId'],
      where: {
        produtoId: { in: produtoIds },
      },
      _sum: {
        quantidadeDisponivel: true,
        quantidadeReservada: true,
      },
    });

    const stockMap = new Map<string, number>();

    for (const row of results) {
      const disponivel = Number(row._sum.quantidadeDisponivel ?? 0);
      const reservada = Number(row._sum.quantidadeReservada ?? 0);
      stockMap.set(row.produtoId, disponivel - reservada);
    }

    // Ensure all requested products have an entry (0 if no inventory records)
    for (const id of produtoIds) {
      if (!stockMap.has(id)) {
        stockMap.set(id, 0);
      }
    }

    return stockMap;
  }
}
