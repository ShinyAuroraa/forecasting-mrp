import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import type {
  PlannedMovement,
  StorageAlertSeverity,
  StorageDepositoResult,
  StorageValidationInput,
  StorageValidationOutput,
  StorageWeekResult,
} from './interfaces/storage-validation.interface';

/**
 * Decimal precision for rounding volume values (4 decimal places).
 */
const VOLUME_DECIMAL_PLACES = 4;
const VOLUME_ROUNDING_FACTOR = Math.pow(10, VOLUME_DECIMAL_PLACES);

/**
 * Decimal precision for rounding percentages (2 decimal places).
 */
const PERCENT_DECIMAL_PLACES = 2;
const PERCENT_ROUNDING_FACTOR = Math.pow(10, PERCENT_DECIMAL_PLACES);

/**
 * Storage utilization threshold for ALERT severity (AC-10).
 */
const ALERT_THRESHOLD = 90;

/**
 * Storage utilization threshold for CRITICAL severity (AC-10).
 */
const CRITICAL_THRESHOLD = 95;

/**
 * Deposito data loaded from the database.
 */
interface DepositoData {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
  readonly capacidadeM3: number;
}

/**
 * Current inventory record grouped by deposito and product.
 */
interface InventoryRecord {
  readonly depositoId: string;
  readonly produtoId: string;
  readonly quantidadeDisponivel: number;
}

/**
 * Product volume data (m3 per unit).
 */
interface ProductVolume {
  readonly id: string;
  readonly volumeM3: number;
}

/**
 * StorageValidationService — Storage Capacity Validation Engine
 *
 * Projects inventory volume per warehouse per week by combining current stock
 * levels with planned receipts (incoming) and gross requirements (outgoing).
 * Compares projected volume against warehouse capacity and generates
 * severity-based alerts when utilization exceeds defined thresholds.
 *
 * Key design decisions:
 *   - AC-8: Projects inventory volume per warehouse per week
 *   - AC-9: Projected volume = current stock + incoming - outgoing
 *   - AC-10: Severity thresholds: >90% = ALERT, >95% = CRITICAL
 *   - AC-11: Alerts include depositoId, week, projected utilization %, severity
 *   - AC-12: Does NOT modify planned orders — read-only validation
 *
 * @see Story 3.9 — CRP & Storage Capacity Validation
 * @see FR-041 — Storage Capacity Validation
 */
@Injectable()
export class StorageValidationService {
  private readonly logger = new Logger(StorageValidationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate storage capacity across all active depositos.
   *
   * Loads depositos with capacity, current inventory, and product volumes.
   * Projects weekly volume by applying planned receipts and gross requirements
   * cumulatively across the planning horizon.
   *
   * @param input - Weekly buckets and planned material movements
   * @returns Storage validation results per deposito with alert counts
   */
  async validateStorage(
    input: StorageValidationInput,
  ): Promise<StorageValidationOutput> {
    this.logger.log(
      `Starting storage validation: ${input.weeklyBuckets.length} weekly bucket(s), ` +
        `${input.plannedReceipts.length} receipt(s), ` +
        `${input.grossRequirements.length} requirement(s)`,
    );

    // Load all required data
    const depositos = await this.loadActiveDepositos();

    if (depositos.length === 0) {
      this.logger.warn(
        'No active depositos with capacity found — storage validation skipped',
      );
      return {
        depositos: [],
        totalAlerts: 0,
        totalCriticals: 0,
      };
    }

    const inventory = await this.loadCurrentInventory();

    // Collect unique product IDs from movements and inventory
    const allProductIds = new Set<string>();
    for (const r of input.plannedReceipts) {
      allProductIds.add(r.produtoId);
    }
    for (const r of input.grossRequirements) {
      allProductIds.add(r.produtoId);
    }
    for (const inv of inventory) {
      allProductIds.add(inv.produtoId);
    }

    const productVolumes = await this.loadProductVolumes([...allProductIds]);

    // Build lookup maps
    const volumeMap = new Map<string, number>();
    for (const pv of productVolumes) {
      volumeMap.set(pv.id, pv.volumeM3);
    }

    // Calculate storage for each deposito
    const depositoResults: StorageDepositoResult[] = [];
    let totalAlerts = 0;
    let totalCriticals = 0;

    for (const deposito of depositos) {
      // Get current inventory for this deposito
      const depositoInventory = inventory.filter(
        (inv) => inv.depositoId === deposito.id,
      );

      const weeklyResults = this.projectWeeklyVolume(
        deposito,
        depositoInventory,
        input.plannedReceipts,
        input.grossRequirements,
        volumeMap,
        input.weeklyBuckets,
      );

      const hasAlert = weeklyResults.some((w) => w.severity === 'ALERT');
      const hasCritical = weeklyResults.some((w) => w.severity === 'CRITICAL');

      const alertCount = weeklyResults.filter(
        (w) => w.severity === 'ALERT',
      ).length;
      const criticalCount = weeklyResults.filter(
        (w) => w.severity === 'CRITICAL',
      ).length;

      totalAlerts += alertCount;
      totalCriticals += criticalCount;

      depositoResults.push({
        depositoId: deposito.id,
        codigo: deposito.codigo,
        nome: deposito.nome,
        weeklyResults,
        hasAlert,
        hasCritical,
      });
    }

    this.logger.log(
      `Storage validation complete: ${depositoResults.length} deposito(s), ` +
        `${totalAlerts} alert(s), ${totalCriticals} critical(s)`,
    );

    return {
      depositos: depositoResults,
      totalAlerts,
      totalCriticals,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Data Loading
  // ────────────────────────────────────────────────────────────────

  /**
   * Load all active depositos with capacity > 0.
   * Depositos without defined capacity (null or 0) are excluded since
   * we cannot calculate utilization without a capacity reference.
   *
   * @returns Array of active depositos with capacity
   */
  async loadActiveDepositos(): Promise<readonly DepositoData[]> {
    const depositos = await this.prisma.deposito.findMany({
      where: {
        ativo: true,
        capacidadeM3: { not: null, gt: 0 },
      },
    });

    return depositos.map((d) => ({
      id: d.id,
      codigo: d.codigo,
      nome: d.nome,
      capacidadeM3: this.toNumber(d.capacidadeM3) ?? 0,
    }));
  }

  /**
   * Load all current inventory records.
   *
   * @returns Array of inventory records with deposito/product/quantity
   */
  async loadCurrentInventory(): Promise<readonly InventoryRecord[]> {
    const records = await this.prisma.inventarioAtual.findMany({
      select: {
        depositoId: true,
        produtoId: true,
        quantidadeDisponivel: true,
      },
    });

    return records.map((r) => ({
      depositoId: r.depositoId,
      produtoId: r.produtoId,
      quantidadeDisponivel: this.toNumber(r.quantidadeDisponivel) ?? 0,
    }));
  }

  /**
   * Load product volumes (m3 per unit) for the given product IDs.
   *
   * @param productIds - Array of product identifiers
   * @returns Array of product volumes (excluding nulls)
   */
  async loadProductVolumes(
    productIds: readonly string[],
  ): Promise<readonly ProductVolume[]> {
    if (productIds.length === 0) {
      return [];
    }

    const products = await this.prisma.produto.findMany({
      where: {
        id: { in: [...productIds] },
        volumeM3: { not: null },
      },
      select: {
        id: true,
        volumeM3: true,
      },
    });

    return products.map((p) => ({
      id: p.id,
      volumeM3: this.toNumber(p.volumeM3) ?? 0,
    }));
  }

  // ────────────────────────────────────────────────────────────────
  // Volume Projection (AC-8, AC-9)
  // ────────────────────────────────────────────────────────────────

  /**
   * Project weekly volume for a deposito across all weekly buckets.
   *
   * AC-9: Projected volume = current stock volume + incoming volume - outgoing volume
   *
   * The projection is cumulative: each week's ending volume becomes the next
   * week's starting volume. Movements are assigned to weeks based on their
   * date falling within [periodStart, periodEnd).
   *
   * Note: We assume all products in a deposito's inventory are stored there.
   * Movements (receipts/requirements) are mapped to this deposito based on
   * inventory presence — in a real system this would need warehouse assignment
   * on the movements themselves.
   *
   * @param deposito - The warehouse with capacity
   * @param currentStock - Current inventory in this deposito
   * @param receipts - All planned receipts (incoming material)
   * @param requirements - All gross requirements (outgoing material)
   * @param volumeMap - Map of productId → volumeM3
   * @param weekBuckets - Weekly time buckets
   * @returns Array of weekly storage results
   */
  projectWeeklyVolume(
    deposito: DepositoData,
    currentStock: readonly InventoryRecord[],
    receipts: readonly PlannedMovement[],
    requirements: readonly PlannedMovement[],
    volumeMap: ReadonlyMap<string, number>,
    weekBuckets: readonly { periodStart: Date; periodEnd: Date }[],
  ): readonly StorageWeekResult[] {
    // Calculate initial volume from current stock
    let runningVolumeM3 = 0;
    for (const inv of currentStock) {
      const unitVolume = volumeMap.get(inv.produtoId) ?? 0;
      runningVolumeM3 += inv.quantidadeDisponivel * unitVolume;
    }

    // Identify which products are in this deposito
    const depositoProductIds = new Set(
      currentStock.map((inv) => inv.produtoId),
    );

    const weeklyResults: StorageWeekResult[] = [];

    for (const bucket of weekBuckets) {
      // Sum incoming volume in this week for products in this deposito
      let incomingVolume = 0;
      for (const receipt of receipts) {
        if (!depositoProductIds.has(receipt.produtoId)) {
          continue;
        }
        const receiptTime = receipt.date.getTime();
        if (
          receiptTime >= bucket.periodStart.getTime() &&
          receiptTime < bucket.periodEnd.getTime()
        ) {
          const unitVolume = volumeMap.get(receipt.produtoId) ?? 0;
          incomingVolume += receipt.quantity * unitVolume;
        }
      }

      // Sum outgoing volume in this week for products in this deposito
      let outgoingVolume = 0;
      for (const req of requirements) {
        if (!depositoProductIds.has(req.produtoId)) {
          continue;
        }
        const reqTime = req.date.getTime();
        if (
          reqTime >= bucket.periodStart.getTime() &&
          reqTime < bucket.periodEnd.getTime()
        ) {
          const unitVolume = volumeMap.get(req.produtoId) ?? 0;
          outgoingVolume += req.quantity * unitVolume;
        }
      }

      // AC-9: projected = current + incoming - outgoing
      runningVolumeM3 = runningVolumeM3 + incomingVolume - outgoingVolume;

      // Ensure volume does not go negative
      runningVolumeM3 = Math.max(0, runningVolumeM3);

      const projectedVolumeM3 = this.roundVolume(runningVolumeM3);

      // Calculate utilization
      const utilizationPercentual =
        deposito.capacidadeM3 > 0
          ? this.roundPercent(
              (projectedVolumeM3 / deposito.capacidadeM3) * 100,
            )
          : 0;

      // AC-10: Determine severity
      const severity = this.determineSeverity(utilizationPercentual);

      weeklyResults.push({
        periodStart: bucket.periodStart,
        projectedVolumeM3,
        capacityM3: deposito.capacidadeM3,
        utilizationPercentual,
        severity,
      });
    }

    return weeklyResults;
  }

  // ────────────────────────────────────────────────────────────────
  // Severity Determination (AC-10)
  // ────────────────────────────────────────────────────────────────

  /**
   * Determine alert severity based on storage utilization percentage.
   *
   * AC-10 rules:
   *   - utilization <= 90% → OK
   *   - 90% < utilization <= 95% → ALERT
   *   - utilization > 95% → CRITICAL
   *
   * @param utilization - Utilization percentage
   * @returns Alert severity
   */
  determineSeverity(utilization: number): StorageAlertSeverity {
    if (utilization <= ALERT_THRESHOLD) {
      return 'OK';
    }

    if (utilization <= CRITICAL_THRESHOLD) {
      return 'ALERT';
    }

    return 'CRITICAL';
  }

  // ────────────────────────────────────────────────────────────────
  // Internal Helpers
  // ────────────────────────────────────────────────────────────────

  /**
   * Safely convert a Prisma Decimal or number to a JavaScript number.
   * Returns null if the value is null or undefined.
   */
  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'object' && 'toNumber' in value) {
      return (value as { toNumber: () => number }).toNumber();
    }
    return null;
  }

  /**
   * Round to 4 decimal places for volume values.
   */
  private roundVolume(value: number): number {
    return (
      Math.round(value * VOLUME_ROUNDING_FACTOR) / VOLUME_ROUNDING_FACTOR
    );
  }

  /**
   * Round to 2 decimal places for percentage values.
   */
  private roundPercent(value: number): number {
    return (
      Math.round(value * PERCENT_ROUNDING_FACTOR) / PERCENT_ROUNDING_FACTOR
    );
  }
}
