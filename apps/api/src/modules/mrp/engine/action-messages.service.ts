import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import {
  ActionMessageType,
  type ActionMessage,
  type ActionMessagesInput,
  type ActionMessagesOutput,
  type PlannedOrderRef,
} from './interfaces/action-messages.interface';

/**
 * Number of milliseconds in one day — used for date arithmetic.
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Period tolerance in days for matching existing orders to planned orders.
 * Existing and planned orders are considered to be in the same period if
 * their dataNecessidade values are within this many days of each other.
 */
const PERIOD_TOLERANCE_DAYS = 3;

/**
 * Decimal precision for rounding (4 decimal places).
 */
const DECIMAL_PLACES = 4;
const ROUNDING_FACTOR = Math.pow(10, DECIMAL_PLACES);

/**
 * Existing order record as loaded from the database.
 * Only fields needed for action message comparison.
 */
interface ExistingOrder {
  readonly id: string;
  readonly produtoId: string;
  readonly tipo: 'COMPRA' | 'PRODUCAO';
  readonly quantidade: number;
  readonly dataNecessidade: Date;
  readonly dataRecebimentoEsperado: Date | null;
  readonly status: string;
}

/**
 * ActionMessagesService — Action Message Generation Engine
 *
 * Compares newly planned orders against existing FIRME/LIBERADA orders
 * for the same product and period, generating action messages that indicate
 * what changes are needed:
 *
 *   - CANCEL: Existing order has no corresponding planned requirement (AC-2)
 *   - INCREASE: Existing order qty < planned requirement (AC-3)
 *   - REDUCE: Existing order qty > planned requirement, demand not zero (AC-4)
 *   - EXPEDITE: Existing delivery date later than planned need date (AC-5)
 *   - NEW: Planned requirement with no corresponding existing order (AC-6)
 *
 * Only FIRME and LIBERADA orders are compared; PLANEJADA and CANCELADA
 * are ignored (AC-9).
 *
 * Each action message is stored in the mensagemAcao field of the
 * corresponding OrdemPlanejada record (AC-7).
 *
 * Messages include delta quantity for INCREASE/REDUCE and date change
 * for EXPEDITE (AC-8).
 *
 * @see Story 3.8 — Action Messages
 * @see FR-039 — Action Messages
 */
@Injectable()
export class ActionMessagesService {
  private readonly logger = new Logger(ActionMessagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate action messages by comparing planned orders against existing
   * FIRME/LIBERADA orders for the same product and type.
   *
   * Algorithm:
   *   1. Load existing active orders (FIRME/LIBERADA) — AC-9
   *   2. Group existing orders by composite key (produtoId::tipo)
   *   3. Group planned orders by same composite key
   *   4. For each key in existing orders:
   *      - No planned orders for key → CANCEL all existing
   *      - Planned orders exist → match by period (±3 days tolerance)
   *        - existingQty < plannedQty → INCREASE
   *        - existingQty > plannedQty > 0 → REDUCE
   *        - existing delivery > planned need → EXPEDITE (priority over qty changes)
   *   5. For each key in planned orders NOT in existing → NEW
   *   6. Update mensagemAcao on affected OrdemPlanejada records — AC-7
   *
   * @param input - Execution context and planned order references
   * @returns Action messages with summary counts
   */
  async generateActionMessages(
    input: ActionMessagesInput,
  ): Promise<ActionMessagesOutput> {
    this.logger.log(
      `Starting action message generation for execucao ${input.execucaoId}: ` +
        `${input.plannedOrders.length} planned order(s) to compare`,
    );

    // Step 1: Load existing active orders (AC-9)
    const existingOrders = await this.loadExistingActiveOrders();

    // Step 2-3: Group by composite key
    const existingByKey = this.groupByCompositeKey(existingOrders);
    const plannedByKey = this.groupPlannedByCompositeKey(input.plannedOrders);

    const messages: ActionMessage[] = [];

    // Step 4: Compare existing orders against planned orders
    for (const [key, existingGroup] of existingByKey.entries()) {
      const plannedGroup = plannedByKey.get(key);

      if (plannedGroup === undefined || plannedGroup.length === 0) {
        // CANCEL: No planned orders for this product/type (AC-2)
        const cancelMessages = this.generateCancelMessages(existingGroup);
        messages.push(...cancelMessages);
      } else {
        // Compare quantities and dates within matching periods
        const comparisonMessages = this.compareOrderGroups(
          existingGroup,
          plannedGroup,
        );
        messages.push(...comparisonMessages);
      }
    }

    // Step 5: NEW messages for planned orders with no existing counterpart (AC-6)
    for (const [key, plannedGroup] of plannedByKey.entries()) {
      if (!existingByKey.has(key)) {
        const newMessages = this.generateNewMessages(plannedGroup);
        messages.push(...newMessages);
      }
    }

    // Step 6: Update mensagemAcao on affected records (AC-7)
    await this.persistActionMessages(messages);

    // Calculate summary counts
    const totalCancel = messages.filter(
      (m) => m.type === ActionMessageType.CANCEL,
    ).length;
    const totalIncrease = messages.filter(
      (m) => m.type === ActionMessageType.INCREASE,
    ).length;
    const totalReduce = messages.filter(
      (m) => m.type === ActionMessageType.REDUCE,
    ).length;
    const totalExpedite = messages.filter(
      (m) => m.type === ActionMessageType.EXPEDITE,
    ).length;
    const totalNew = messages.filter(
      (m) => m.type === ActionMessageType.NEW,
    ).length;

    this.logger.log(
      `Action message generation complete: ` +
        `${totalCancel} CANCEL, ${totalIncrease} INCREASE, ` +
        `${totalReduce} REDUCE, ${totalExpedite} EXPEDITE, ${totalNew} NEW`,
    );

    return {
      execucaoId: input.execucaoId,
      messages,
      totalCancel,
      totalIncrease,
      totalReduce,
      totalExpedite,
      totalNew,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Data Loading (AC-9)
  // ────────────────────────────────────────────────────────────────

  /**
   * Load existing orders with status FIRME or LIBERADA.
   * PLANEJADA and CANCELADA orders are excluded per AC-9.
   *
   * @returns Array of existing active orders
   */
  private async loadExistingActiveOrders(): Promise<readonly ExistingOrder[]> {
    const records = await this.prisma.ordemPlanejada.findMany({
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

    return records.map((record) => ({
      id: record.id,
      produtoId: record.produtoId,
      tipo: record.tipo as 'COMPRA' | 'PRODUCAO',
      quantidade: this.decimalToNumber(record.quantidade),
      dataNecessidade: record.dataNecessidade,
      dataRecebimentoEsperado: record.dataRecebimentoEsperado ?? null,
      status: record.status,
    }));
  }

  // ────────────────────────────────────────────────────────────────
  // Grouping
  // ────────────────────────────────────────────────────────────────

  /**
   * Build composite key for grouping: "produtoId::tipo"
   */
  private compositeKey(produtoId: string, tipo: string): string {
    return `${produtoId}::${tipo}`;
  }

  /**
   * Group existing orders by composite key (produtoId::tipo).
   */
  private groupByCompositeKey(
    orders: readonly ExistingOrder[],
  ): ReadonlyMap<string, readonly ExistingOrder[]> {
    const map = new Map<string, ExistingOrder[]>();

    for (const order of orders) {
      const key = this.compositeKey(order.produtoId, order.tipo);
      const group = map.get(key);
      if (group !== undefined) {
        group.push(order);
      } else {
        map.set(key, [order]);
      }
    }

    return map;
  }

  /**
   * Group planned orders by composite key (produtoId::tipo).
   */
  private groupPlannedByCompositeKey(
    orders: readonly PlannedOrderRef[],
  ): ReadonlyMap<string, readonly PlannedOrderRef[]> {
    const map = new Map<string, PlannedOrderRef[]>();

    for (const order of orders) {
      const key = this.compositeKey(order.produtoId, order.tipo);
      const group = map.get(key);
      if (group !== undefined) {
        group.push(order);
      } else {
        map.set(key, [order]);
      }
    }

    return map;
  }

  // ────────────────────────────────────────────────────────────────
  // CANCEL Messages (AC-2)
  // ────────────────────────────────────────────────────────────────

  /**
   * Generate CANCEL messages for existing orders with no corresponding
   * planned requirement. This means demand has dropped to zero.
   *
   * @param existingOrders - Existing FIRME/LIBERADA orders to cancel
   * @returns Array of CANCEL action messages
   */
  private generateCancelMessages(
    existingOrders: readonly ExistingOrder[],
  ): readonly ActionMessage[] {
    return existingOrders.map((order) => ({
      type: ActionMessageType.CANCEL,
      produtoId: order.produtoId,
      existingOrderId: order.id,
      plannedOrderId: null,
      message: `CANCEL: No requirement for ${this.formatDate(order.dataNecessidade)}`,
      deltaQuantity: null,
      deltaDays: null,
      currentDate: order.dataNecessidade,
      requiredDate: null,
    }));
  }

  // ────────────────────────────────────────────────────────────────
  // NEW Messages (AC-6)
  // ────────────────────────────────────────────────────────────────

  /**
   * Generate NEW messages for planned orders with no corresponding
   * existing order. This means new demand has appeared.
   *
   * @param plannedOrders - Planned orders with no existing counterpart
   * @returns Array of NEW action messages
   */
  private generateNewMessages(
    plannedOrders: readonly PlannedOrderRef[],
  ): readonly ActionMessage[] {
    return plannedOrders.map((order) => ({
      type: ActionMessageType.NEW,
      produtoId: order.produtoId,
      existingOrderId: null,
      plannedOrderId: order.id,
      message: `NEW: ${this.round(order.quantidade)} units needed by ${this.formatDate(order.dataNecessidade)}`,
      deltaQuantity: null,
      deltaDays: null,
      currentDate: null,
      requiredDate: order.dataNecessidade,
    }));
  }

  // ────────────────────────────────────────────────────────────────
  // Order Group Comparison (AC-3, AC-4, AC-5)
  // ────────────────────────────────────────────────────────────────

  /**
   * Compare existing orders against planned orders for the same product/type.
   *
   * Matching strategy:
   *   - Same produtoId and tipo (already grouped)
   *   - Period overlap: existing.dataNecessidade within ±3 days of planned.dataNecessidade
   *   - Multiple existing orders matching a single planned period are aggregated
   *
   * Priority when both quantity and date changes exist:
   *   - EXPEDITE takes priority over INCREASE/REDUCE
   *
   * @param existingOrders - Existing FIRME/LIBERADA orders for this product/type
   * @param plannedOrders - Planned orders for this product/type
   * @returns Array of action messages (INCREASE, REDUCE, EXPEDITE, or CANCEL for unmatched)
   */
  private compareOrderGroups(
    existingOrders: readonly ExistingOrder[],
    plannedOrders: readonly PlannedOrderRef[],
  ): readonly ActionMessage[] {
    const messages: ActionMessage[] = [];
    const matchedExistingIds = new Set<string>();

    for (const planned of plannedOrders) {
      // Find all existing orders matching this planned order's period
      const matchingExisting = existingOrders.filter(
        (existing) =>
          !matchedExistingIds.has(existing.id) &&
          this.isWithinPeriodTolerance(
            existing.dataNecessidade,
            planned.dataNecessidade,
          ),
      );

      if (matchingExisting.length === 0) {
        // No matching existing order → this planned order is NEW within this group
        // (existing orders exist for this product/type, but not in this period)
        messages.push({
          type: ActionMessageType.NEW,
          produtoId: planned.produtoId,
          existingOrderId: null,
          plannedOrderId: planned.id,
          message: `NEW: ${this.round(planned.quantidade)} units needed by ${this.formatDate(planned.dataNecessidade)}`,
          deltaQuantity: null,
          deltaDays: null,
          currentDate: null,
          requiredDate: planned.dataNecessidade,
        });
        continue;
      }

      // Mark all matched existing orders
      for (const existing of matchingExisting) {
        matchedExistingIds.add(existing.id);
      }

      // Aggregate existing quantities for comparison
      const existingQty = this.round(
        matchingExisting.reduce((sum, o) => sum + o.quantidade, 0),
      );
      const plannedQty = this.round(planned.quantidade);

      // Use the first matching existing order as representative for IDs
      const representativeExisting = matchingExisting[0];

      // Check for date change first — EXPEDITE takes priority (AC-5)
      const expediteMessage = this.checkExpedite(
        representativeExisting,
        planned,
      );

      if (expediteMessage !== null) {
        messages.push(expediteMessage);
        continue;
      }

      // Check for quantity changes (AC-3, AC-4)
      if (existingQty < plannedQty) {
        // INCREASE: existing quantity is insufficient
        const delta = this.round(plannedQty - existingQty);
        messages.push({
          type: ActionMessageType.INCREASE,
          produtoId: planned.produtoId,
          existingOrderId: representativeExisting.id,
          plannedOrderId: planned.id,
          message: `INCREASE: +${delta} units needed`,
          deltaQuantity: delta,
          deltaDays: null,
          currentDate: null,
          requiredDate: null,
        });
      } else if (existingQty > plannedQty) {
        // REDUCE: existing quantity exceeds planned (but planned > 0)
        const delta = this.round(existingQty - plannedQty);
        messages.push({
          type: ActionMessageType.REDUCE,
          produtoId: planned.produtoId,
          existingOrderId: representativeExisting.id,
          plannedOrderId: planned.id,
          message: `REDUCE: -${delta} units excess`,
          deltaQuantity: delta,
          deltaDays: null,
          currentDate: null,
          requiredDate: null,
        });
      }
      // else: quantities match exactly → no action message needed
    }

    // Any existing orders not matched to any planned order → CANCEL
    for (const existing of existingOrders) {
      if (!matchedExistingIds.has(existing.id)) {
        messages.push({
          type: ActionMessageType.CANCEL,
          produtoId: existing.produtoId,
          existingOrderId: existing.id,
          plannedOrderId: null,
          message: `CANCEL: No requirement for ${this.formatDate(existing.dataNecessidade)}`,
          deltaQuantity: null,
          deltaDays: null,
          currentDate: existing.dataNecessidade,
          requiredDate: null,
        });
      }
    }

    return messages;
  }

  // ────────────────────────────────────────────────────────────────
  // EXPEDITE Check (AC-5)
  // ────────────────────────────────────────────────────────────────

  /**
   * Check if an existing order needs to be expedited.
   * An EXPEDITE message is generated when the existing order's delivery date
   * (dataRecebimentoEsperado) is later than the planned order's need date.
   *
   * EXPEDITE takes priority over quantity changes when both apply.
   *
   * @param existing - Existing order with delivery date
   * @param planned - Planned order with need date
   * @returns EXPEDITE action message or null if no expedite needed
   */
  private checkExpedite(
    existing: ExistingOrder,
    planned: PlannedOrderRef,
  ): ActionMessage | null {
    const existingDelivery = existing.dataRecebimentoEsperado;

    if (existingDelivery === null) {
      return null;
    }

    const existingTime = existingDelivery.getTime();
    const plannedTime = planned.dataNecessidade.getTime();

    if (existingTime > plannedTime) {
      const deltaDays = Math.round(
        (existingTime - plannedTime) / MS_PER_DAY,
      );

      return {
        type: ActionMessageType.EXPEDITE,
        produtoId: planned.produtoId,
        existingOrderId: existing.id,
        plannedOrderId: planned.id,
        message: `EXPEDITE: Move forward ${deltaDays} days`,
        deltaQuantity: null,
        deltaDays,
        currentDate: existingDelivery,
        requiredDate: planned.dataNecessidade,
      };
    }

    return null;
  }

  // ────────────────────────────────────────────────────────────────
  // Period Matching
  // ────────────────────────────────────────────────────────────────

  /**
   * Check if two dates fall within the period tolerance (±3 days).
   * This handles weekly bucket alignment differences between existing
   * and planned orders.
   *
   * @param date1 - First date (typically existing order date)
   * @param date2 - Second date (typically planned order date)
   * @returns True if dates are within ±PERIOD_TOLERANCE_DAYS of each other
   */
  private isWithinPeriodTolerance(date1: Date, date2: Date): boolean {
    const diffMs = Math.abs(date1.getTime() - date2.getTime());
    const diffDays = diffMs / MS_PER_DAY;
    return diffDays <= PERIOD_TOLERANCE_DAYS;
  }

  // ────────────────────────────────────────────────────────────────
  // Persistence (AC-7)
  // ────────────────────────────────────────────────────────────────

  /**
   * Persist action messages to the mensagemAcao field on affected
   * OrdemPlanejada records.
   *
   * - For planned orders (NEW, INCREASE, REDUCE, EXPEDITE): update by plannedOrderId
   * - For existing orders (CANCEL): update by existingOrderId
   *
   * @param messages - Action messages to persist
   */
  private async persistActionMessages(
    messages: readonly ActionMessage[],
  ): Promise<void> {
    const updates: Promise<unknown>[] = [];

    for (const message of messages) {
      // Update planned order's mensagemAcao if applicable
      if (message.plannedOrderId !== null) {
        updates.push(
          this.prisma.ordemPlanejada.update({
            where: { id: message.plannedOrderId },
            data: { mensagemAcao: message.message },
          }),
        );
      }

      // Update existing order's mensagemAcao for CANCEL messages
      if (
        message.type === ActionMessageType.CANCEL &&
        message.existingOrderId !== null
      ) {
        updates.push(
          this.prisma.ordemPlanejada.update({
            where: { id: message.existingOrderId },
            data: { mensagemAcao: message.message },
          }),
        );
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates);
      this.logger.log(
        `Updated mensagemAcao on ${updates.length} OrdemPlanejada record(s)`,
      );
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Internal Helpers
  // ────────────────────────────────────────────────────────────────

  /**
   * Convert a Prisma Decimal value to a JavaScript number.
   * Handles both native numbers and Prisma Decimal objects.
   */
  private decimalToNumber(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }
    if (
      value !== null &&
      value !== undefined &&
      typeof (value as { toNumber: () => number }).toNumber === 'function'
    ) {
      return (value as { toNumber: () => number }).toNumber();
    }
    return 0;
  }

  /**
   * Round to 4 decimal places to avoid floating-point precision issues.
   * Uses factor-based rounding for deterministic results.
   */
  private round(value: number): number {
    return Math.round(value * ROUNDING_FACTOR) / ROUNDING_FACTOR;
  }

  /**
   * Format a date as YYYY-MM-DD string for use in action messages.
   * Uses UTC to avoid timezone-related date shifts.
   */
  private formatDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
