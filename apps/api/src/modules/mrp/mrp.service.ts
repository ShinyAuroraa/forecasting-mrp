import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { MrpRepository } from './mrp.repository';
import { ExecuteMrpDto } from './dto/execute-mrp.dto';
import { FilterExecutionsDto } from './dto/filter-executions.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { FilterCapacityDto } from './dto/filter-capacity.dto';
import { FilterStockParamsDto } from './dto/filter-stock-params.dto';

import { MpsService } from './engine/mps.service';
import { StockParamsService } from './engine/stock-params.service';
import { BomExplosionService } from './engine/bom-explosion.service';
import { NetRequirementService } from './engine/net-requirement.service';
import { LotSizingService } from './engine/lot-sizing.service';
import { OrderGenerationService } from './engine/order-generation.service';
import { ActionMessagesService } from './engine/action-messages.service';
import { CrpService } from './engine/crp.service';
import { StorageValidationService } from './engine/storage-validation.service';
import { MrpInventoryHelper } from './engine/mrp-inventory.helper';
import { MrpScheduledReceiptsHelper } from './engine/mrp-scheduled-receipts.helper';

import type { MpsOutput } from './engine/interfaces/mps.interface';
import type {
  BomExplosionInput,
  BomExplosionResult,
  BomLineInput,
  TimePhasedDemand,
} from './engine/interfaces/bom-explosion.interface';
import type { MrpGridRow } from './engine/interfaces/mrp-grid.interface';
import type { LotSizingInput, LotSizingOutput } from './engine/interfaces/lot-sizing.interface';
import type {
  PlannedOrderInput,
  OrderGenerationOutput,
} from './engine/interfaces/order-generation.interface';
import type { ActionMessagesOutput } from './engine/interfaces/action-messages.interface';
import type { CrpOutput, WeeklyBucket } from './engine/interfaces/crp.interface';
import type { StorageValidationOutput, PlannedMovement } from './engine/interfaces/storage-validation.interface';

/**
 * Step names used in the MRP execution pipeline.
 * Stored in ExecucaoStepLog.stepName for tracking progress.
 */
const STEP_NAMES = {
  MPS_GENERATION: 'MPS_GENERATION',
  STOCK_PARAMETERS: 'STOCK_PARAMETERS',
  BOM_EXPLOSION_NETTING: 'BOM_EXPLOSION_NETTING',
  LOT_SIZING: 'LOT_SIZING',
  ORDER_GENERATION: 'ORDER_GENERATION',
  ACTION_MESSAGES: 'ACTION_MESSAGES',
  CRP: 'CRP',
  STORAGE_VALIDATION: 'STORAGE_VALIDATION',
} as const;

/**
 * Result summary shape stored in ExecucaoPlanejamento.resultadoResumo.
 */
interface MrpResultSummary {
  readonly totalProductsProcessed: number;
  readonly totalDemandPlanned: number;
  readonly totalStockParamsCalculated: number;
  readonly totalNetRequirementsProcessed: number;
  readonly totalLotSizedProducts: number;
  readonly totalOrdersGenerated: number;
  readonly totalCompraOrders: number;
  readonly totalProducaoOrders: number;
  readonly totalActionMessages: number;
  readonly totalOverloadedWeeks: number;
  readonly totalStorageAlerts: number;
  readonly totalStorageCriticals: number;
  readonly stepDurations: Record<string, number>;
}

/**
 * MrpService — MRP Orchestrator
 *
 * Orchestrates the full MRP execution pipeline by invoking all 8 engine
 * services in sequence. Each step is logged to ExecucaoStepLog with
 * timing and record counts.
 *
 * Pipeline:
 *   1. MPS Generation (level-0 demand)
 *   2. Stock Parameters (SS, ROP, EOQ per SKU)
 *   3. BOM Explosion + Netting (gross → net requirements)
 *   4. Lot Sizing (net requirements → planned order quantities)
 *   5. Order Generation (persist planned orders with enrichment)
 *   6. Action Messages (compare planned vs existing orders)
 *   7. CRP (capacity requirements planning)
 *   8. Storage Validation (warehouse volume projection)
 *
 * Concurrency guard: rejects if another MRP execution is EXECUTANDO.
 * Synchronous within a single request — no BullMQ.
 *
 * @see Story 3.10 — MRP Orchestrator & Execution API
 */
@Injectable()
export class MrpService {
  private readonly logger = new Logger(MrpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: MrpRepository,
    private readonly mpsService: MpsService,
    private readonly stockParamsService: StockParamsService,
    private readonly bomExplosionService: BomExplosionService,
    private readonly netRequirementService: NetRequirementService,
    private readonly lotSizingService: LotSizingService,
    private readonly orderGenerationService: OrderGenerationService,
    private readonly actionMessagesService: ActionMessagesService,
    private readonly crpService: CrpService,
    private readonly storageValidationService: StorageValidationService,
    private readonly inventoryHelper: MrpInventoryHelper,
    private readonly scheduledReceiptsHelper: MrpScheduledReceiptsHelper,
  ) {}

  // ────────────────────────────────────────────────────────────────
  // Main Execution
  // ────────────────────────────────────────────────────────────────

  /**
   * Execute the full MRP pipeline synchronously.
   *
   * @param dto - Optional execution parameters
   * @returns Execution result with ID, final status, and message
   * @throws ConflictException if another MRP execution is currently running
   */
  async executeMrp(dto: ExecuteMrpDto): Promise<{
    readonly execucaoId: string;
    readonly status: string;
    readonly message: string;
    readonly resultadoResumo?: MrpResultSummary;
  }> {
    // Step 0: Concurrency guard
    const running = await this.repository.checkRunningExecution();
    if (running !== null) {
      throw new ConflictException(
        `MRP execution ${running.id} is already running. Wait for it to complete or mark it as ERRO.`,
      );
    }

    // Create execution record
    const execution = await this.repository.createExecution({
      tipo: 'MRP',
      status: 'PENDENTE',
      gatilho: 'MANUAL',
      parametros: {
        planningHorizonWeeks: dto.planningHorizonWeeks ?? null,
        firmOrderHorizonWeeks: dto.firmOrderHorizonWeeks ?? null,
        forceRecalculate: dto.forceRecalculate ?? false,
      },
    });

    const execucaoId = execution.id;

    this.logger.log(`MRP execution ${execucaoId} created — starting pipeline`);

    // Update status to EXECUTANDO
    await this.repository.updateExecutionStatus(execucaoId, 'EXECUTANDO', {
      startedAt: new Date(),
    });

    const stepDurations: Record<string, number> = {};

    try {
      // ── Step 1: MPS Generation ──────────────────────────────────
      let mpsOutput: MpsOutput | undefined;
      stepDurations[STEP_NAMES.MPS_GENERATION] = await this.executeStep(execucaoId, STEP_NAMES.MPS_GENERATION, 1, async () => {
        mpsOutput = await this.mpsService.generateMps({
          planningHorizonWeeks: dto.planningHorizonWeeks,
          firmOrderHorizonWeeks: dto.firmOrderHorizonWeeks,
        });
        const recordsProcessed = mpsOutput.totalProductsProcessed;
        return {
          recordsProcessed,
          details: {
            totalDemandPlanned: mpsOutput.totalDemandPlanned,
            planningHorizonWeeks: mpsOutput.planningHorizonWeeks,
            firmOrderHorizonWeeks: mpsOutput.firmOrderHorizonWeeks,
          },
        };
      });

      // ── Step 2: Stock Parameters ────────────────────────────────
      let stockParamsCount = 0;
      const forceRecalculate = dto.forceRecalculate ?? false;
      stepDurations[STEP_NAMES.STOCK_PARAMETERS] = await this.executeStep(execucaoId, STEP_NAMES.STOCK_PARAMETERS, 2, async () => {
        const allProductIds = await this.loadAllActiveProductIds();

        // When forceRecalculate is false, check if recent params exist and skip recalculation
        let skippedCount = 0;
        if (!forceRecalculate) {
          const existingParams = await this.prisma.parametrosEstoque.findMany({
            where: { produtoId: { in: allProductIds } },
            select: { produtoId: true },
            distinct: ['produtoId'],
          });
          const existingSet = new Set(existingParams.map((p) => p.produtoId));

          for (const produtoId of allProductIds) {
            if (existingSet.has(produtoId)) {
              skippedCount++;
              continue;
            }
            await this.stockParamsService.calculateForProduct(produtoId, execucaoId);
            stockParamsCount++;
          }
        } else {
          for (const produtoId of allProductIds) {
            await this.stockParamsService.calculateForProduct(produtoId, execucaoId);
            stockParamsCount++;
          }
        }

        return {
          recordsProcessed: stockParamsCount,
          details: { totalProducts: allProductIds.length, forceRecalculate, skippedExisting: skippedCount },
        };
      });

      // ── Step 3: BOM Explosion + Netting ─────────────────────────
      let bomResult: BomExplosionResult | undefined;
      let netRequirementResults: MrpGridRow[] = [];
      stepDurations[STEP_NAMES.BOM_EXPLOSION_NETTING] = await this.executeStep(execucaoId, STEP_NAMES.BOM_EXPLOSION_NETTING, 3, async () => {
        // 3a. Prepare BOM explosion input from MPS output
        const bomInput = await this.prepareBomExplosionInput(mpsOutput!);
        bomResult = this.bomExplosionService.explode(bomInput);

        // 3b. Calculate net requirements for all products with gross requirements
        const allProductIdsWithDemand = [...bomResult.grossRequirements.keys()];
        const inventoryMap = await this.inventoryHelper.getAvailableStockBatch(
          allProductIdsWithDemand,
        );

        // Load stock params for safety stock values
        const stockParamsMap = await this.loadStockParamsMap(execucaoId, allProductIdsWithDemand);

        // Build weekly buckets from MPS output
        const weeklyBuckets = this.buildWeeklyBucketsFromMps(mpsOutput!);

        // Get scheduled receipts for all products
        const scheduledReceiptsMap = await this.scheduledReceiptsHelper.getScheduledReceiptsBatch(
          allProductIdsWithDemand,
          weeklyBuckets,
        );

        netRequirementResults = [];
        for (const [produtoId, grossDemands] of bomResult.grossRequirements) {
          const initialStock = inventoryMap.get(produtoId) ?? 0;
          const safetyStock = stockParamsMap.get(produtoId) ?? 0;
          const scheduledReceiptsForProduct = scheduledReceiptsMap.get(produtoId) ?? new Map();

          const periods = grossDemands.map((demand, idx) => ({
            periodStart: demand.periodStart,
            periodEnd: demand.periodEnd,
            grossRequirement: demand.quantity,
            scheduledReceipts: scheduledReceiptsForProduct.get(idx) ?? 0,
          }));

          const gridRow = this.netRequirementService.calculateNetRequirements({
            produtoId,
            initialStock,
            safetyStock,
            periods,
          });

          netRequirementResults.push(gridRow);
        }

        return {
          recordsProcessed: netRequirementResults.length,
          details: {
            totalBomLevels: Object.keys(bomResult.lowLevelCodes).length,
            totalProductsWithDemand: allProductIdsWithDemand.length,
          },
        };
      });

      // ── Step 4: Lot Sizing ──────────────────────────────────────
      const lotSizingResults: LotSizingOutput[] = [];
      stepDurations[STEP_NAMES.LOT_SIZING] = await this.executeStep(execucaoId, STEP_NAMES.LOT_SIZING, 4, async () => {
        const stockParamsRecords = await this.loadStockParamsRecords(execucaoId);
        const productDataMap = await this.loadProductLotSizingData(
          netRequirementResults.map((r) => r.produtoId),
        );

        for (const gridRow of netRequirementResults) {
          const netRequirements = gridRow.periods
            .filter((p) => p.netRequirement > 0)
            .map((p) => ({
              periodStart: p.periodStart,
              periodEnd: p.periodEnd,
              quantity: p.netRequirement,
            }));

          if (netRequirements.length === 0) {
            continue;
          }

          const productData = productDataMap.get(gridRow.produtoId);
          const stockParams = stockParamsRecords.get(gridRow.produtoId);

          const lotSizingOutput = this.lotSizingService.calculateLotSizing({
            produtoId: gridRow.produtoId,
            netRequirements,
            method: (productData?.lotificacao ?? 'L4L') as 'L4L' | 'EOQ' | 'SILVER_MEAL' | 'WAGNER_WHITIN',
            eoqValue: stockParams?.eoq ?? 0,
            loteMinimo: productData?.loteMinimo ?? 1,
            multiploCompra: productData?.multiploCompra ?? 1,
            moq: productData?.moq ?? 1,
            leadTimePeriods: productData?.leadTimePeriods ?? 0,
            orderingCost: productData?.custoPedido ?? 0,
            holdingCostPerUnit: productData?.holdingCostPerUnit ?? 0,
          });

          lotSizingResults.push(lotSizingOutput);
        }

        return {
          recordsProcessed: lotSizingResults.length,
          details: {
            totalPlannedOrders: lotSizingResults.reduce(
              (sum, r) => sum + r.plannedOrderReceipts.length,
              0,
            ),
          },
        };
      });

      // ── Step 5: Order Generation ────────────────────────────────
      let orderGenOutput: OrderGenerationOutput | undefined;
      stepDurations[STEP_NAMES.ORDER_GENERATION] = await this.executeStep(execucaoId, STEP_NAMES.ORDER_GENERATION, 5, async () => {
        const productTypesMap = await this.loadProductTypesMap(
          lotSizingResults.map((r) => r.produtoId),
        );

        const plannedOrderInputs: PlannedOrderInput[] = [];
        for (const lotResult of lotSizingResults) {
          const tipoProduto = productTypesMap.get(lotResult.produtoId) ?? 'MATERIA_PRIMA';

          for (const receipt of lotResult.plannedOrderReceipts) {
            plannedOrderInputs.push({
              produtoId: lotResult.produtoId,
              tipoProduto,
              quantity: receipt.quantity,
              dataNecessidade: receipt.periodStart,
              lotificacaoUsada:
                (await this.getProductLotificacao(lotResult.produtoId)) ?? undefined,
            });
          }
        }

        orderGenOutput = await this.orderGenerationService.generateOrders({
          execucaoId,
          plannedOrders: plannedOrderInputs,
        });

        return {
          recordsProcessed: orderGenOutput.orders.length,
          details: {
            totalCompraOrders: orderGenOutput.totalCompraOrders,
            totalProducaoOrders: orderGenOutput.totalProducaoOrders,
            totalCustoEstimado: orderGenOutput.totalCustoEstimado,
          },
        };
      });

      // ── Step 6: Action Messages ─────────────────────────────────
      let actionMessagesOutput: ActionMessagesOutput | undefined;
      stepDurations[STEP_NAMES.ACTION_MESSAGES] = await this.executeStep(execucaoId, STEP_NAMES.ACTION_MESSAGES, 6, async () => {
        // Load newly created planned orders for comparison
        const newPlannedOrders = await this.prisma.ordemPlanejada.findMany({
          where: { execucaoId },
          select: {
            id: true,
            produtoId: true,
            tipo: true,
            quantidade: true,
            dataNecessidade: true,
          },
        });

        const plannedOrderRefs = newPlannedOrders.map((o) => ({
          id: o.id,
          produtoId: o.produtoId,
          tipo: o.tipo as 'COMPRA' | 'PRODUCAO',
          quantidade: typeof o.quantidade === 'number'
            ? o.quantidade
            : Number(o.quantidade),
          dataNecessidade: o.dataNecessidade,
        }));

        actionMessagesOutput = await this.actionMessagesService.generateActionMessages({
          execucaoId,
          plannedOrders: plannedOrderRefs,
        });

        return {
          recordsProcessed: actionMessagesOutput.messages.length,
          details: {
            totalCancel: actionMessagesOutput.totalCancel,
            totalIncrease: actionMessagesOutput.totalIncrease,
            totalReduce: actionMessagesOutput.totalReduce,
            totalExpedite: actionMessagesOutput.totalExpedite,
            totalNew: actionMessagesOutput.totalNew,
          },
        };
      });

      // ── Step 7: CRP ─────────────────────────────────────────────
      let crpOutput: CrpOutput | undefined;
      stepDurations[STEP_NAMES.CRP] = await this.executeStep(execucaoId, STEP_NAMES.CRP, 7, async () => {
        const weeklyBuckets = this.buildWeeklyBucketsFromMps(mpsOutput!);
        const crpBuckets: WeeklyBucket[] = weeklyBuckets.map((b) => ({
          periodStart: b.periodStart,
          periodEnd: b.periodEnd,
        }));

        crpOutput = await this.crpService.calculateCrp({
          execucaoId,
          weeklyBuckets: crpBuckets,
        });

        return {
          recordsProcessed: crpOutput.workCenters.length,
          details: {
            totalOverloadedWeeks: crpOutput.totalOverloadedWeeks,
          },
        };
      });

      // ── Step 8: Storage Validation ──────────────────────────────
      let storageOutput: StorageValidationOutput | undefined;
      stepDurations[STEP_NAMES.STORAGE_VALIDATION] = await this.executeStep(execucaoId, STEP_NAMES.STORAGE_VALIDATION, 8, async () => {
        const weeklyBuckets = this.buildWeeklyBucketsFromMps(mpsOutput!);

        // Build planned receipts from generated orders
        const plannedReceipts: PlannedMovement[] = (orderGenOutput?.orders ?? []).map((o) => ({
          produtoId: o.produtoId,
          quantity: o.quantidade,
          date: o.dataNecessidade,
        }));

        // Build gross requirements from BOM explosion
        const grossRequirements: PlannedMovement[] = [];
        if (bomResult) {
          for (const [produtoId, demands] of bomResult.grossRequirements) {
            for (const demand of demands) {
              if (demand.quantity > 0) {
                grossRequirements.push({
                  produtoId,
                  quantity: demand.quantity,
                  date: demand.periodStart,
                });
              }
            }
          }
        }

        storageOutput = await this.storageValidationService.validateStorage({
          weeklyBuckets,
          plannedReceipts,
          grossRequirements,
        });

        return {
          recordsProcessed: storageOutput.depositos.length,
          details: {
            totalAlerts: storageOutput.totalAlerts,
            totalCriticals: storageOutput.totalCriticals,
          },
        };
      });

      // ── Completion ──────────────────────────────────────────────
      const resultadoResumo: MrpResultSummary = {
        totalProductsProcessed: mpsOutput?.totalProductsProcessed ?? 0,
        totalDemandPlanned: mpsOutput?.totalDemandPlanned ?? 0,
        totalStockParamsCalculated: stockParamsCount,
        totalNetRequirementsProcessed: netRequirementResults.length,
        totalLotSizedProducts: lotSizingResults.length,
        totalOrdersGenerated: orderGenOutput?.orders.length ?? 0,
        totalCompraOrders: orderGenOutput?.totalCompraOrders ?? 0,
        totalProducaoOrders: orderGenOutput?.totalProducaoOrders ?? 0,
        totalActionMessages: actionMessagesOutput?.messages.length ?? 0,
        totalOverloadedWeeks: crpOutput?.totalOverloadedWeeks ?? 0,
        totalStorageAlerts: storageOutput?.totalAlerts ?? 0,
        totalStorageCriticals: storageOutput?.totalCriticals ?? 0,
        stepDurations,
      };

      await this.repository.updateExecutionStatus(execucaoId, 'CONCLUIDO', {
        completedAt: new Date(),
        resultadoResumo: resultadoResumo as unknown as Record<string, unknown>,
      });

      this.logger.log(
        `MRP execution ${execucaoId} completed successfully — ` +
          `${resultadoResumo.totalOrdersGenerated} orders generated`,
      );

      return {
        execucaoId,
        status: 'CONCLUIDO',
        message: 'MRP execution completed successfully',
        resultadoResumo,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `MRP execution ${execucaoId} failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      await this.repository.updateExecutionStatus(execucaoId, 'ERRO', {
        completedAt: new Date(),
        errorMessage,
      });

      return {
        execucaoId,
        status: 'ERRO',
        message: `MRP execution failed: ${errorMessage}`,
      };
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Step Execution Helper
  // ────────────────────────────────────────────────────────────────

  /**
   * Execute a single pipeline step with logging and error handling.
   *
   * Creates a step log entry on start, updates it on completion or failure.
   * If the step function throws, the error is re-thrown to halt the pipeline.
   *
   * @param execucaoId - Execution identifier
   * @param stepName - Human-readable step name
   * @param stepOrder - Step sequence number (1-8)
   * @param fn - Async function performing the step work
   * @returns Duration in milliseconds
   */
  private async executeStep(
    execucaoId: string,
    stepName: string,
    stepOrder: number,
    fn: () => Promise<{ recordsProcessed: number; details?: object }>,
  ): Promise<number> {
    const startTime = Date.now();
    const stepLog = await this.repository.createStepLog({
      execucaoId,
      stepName,
      stepOrder,
      status: 'RUNNING',
      startedAt: new Date(),
    });

    try {
      const result = await fn();
      const durationMs = Date.now() - startTime;

      await this.repository.updateStepLog(stepLog.id, {
        status: 'COMPLETED',
        recordsProcessed: result.recordsProcessed,
        durationMs,
        completedAt: new Date(),
        details: (result.details ?? {}) as Record<string, unknown>,
      });

      this.logger.log(
        `Step ${stepOrder}/${Object.keys(STEP_NAMES).length} [${stepName}] completed: ` +
          `${result.recordsProcessed} records, ${durationMs}ms`,
      );

      return durationMs;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.repository.updateStepLog(stepLog.id, {
        status: 'FAILED',
        durationMs,
        completedAt: new Date(),
        details: { error: errorMessage } as Record<string, unknown>,
      });

      this.logger.error(
        `Step ${stepOrder}/${Object.keys(STEP_NAMES).length} [${stepName}] failed: ${errorMessage}`,
      );

      throw error;
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Read Endpoints (delegated to repository)
  // ────────────────────────────────────────────────────────────────

  /**
   * Find all MRP executions with pagination.
   */
  async findAllExecutions(filters: FilterExecutionsDto) {
    return this.repository.findExecutions(filters);
  }

  /**
   * Find a single MRP execution by ID with step logs.
   *
   * @throws NotFoundException if execution not found
   */
  async findExecutionById(id: string) {
    const execution = await this.repository.findExecutionById(id);
    if (execution === null) {
      throw new NotFoundException(`Execution with id ${id} not found`);
    }
    return execution;
  }

  /**
   * Find planned orders with pagination and filters.
   */
  async findOrders(filters: FilterOrdersDto) {
    return this.repository.findOrders(filters);
  }

  /**
   * Find capacity load records with pagination and filters.
   */
  async findCapacity(filters: FilterCapacityDto) {
    return this.repository.findCapacity(filters);
  }

  /**
   * Find stock parameter records with pagination and filters.
   */
  async findStockParams(filters: FilterStockParamsDto) {
    return this.repository.findStockParams(filters);
  }

  /**
   * Run Monte Carlo safety stock simulation for a product (Story 5.2).
   * Delegates to StockParamsService.runMonteCarloSimulation.
   */
  async runMonteCarloSimulation(
    produtoId: string,
    serviceLevel?: number,
    iterations?: number,
  ) {
    return this.stockParamsService.runMonteCarloSimulation(
      produtoId,
      serviceLevel,
      iterations,
    );
  }

  // ────────────────────────────────────────────────────────────────
  // Data Preparation Helpers
  // ────────────────────────────────────────────────────────────────

  /**
   * Load all active product IDs for stock parameter calculation.
   */
  private async loadAllActiveProductIds(): Promise<string[]> {
    const products = await this.prisma.produto.findMany({
      where: { ativo: true },
      select: { id: true },
    });
    return products.map((p) => p.id);
  }

  /**
   * Prepare BOM explosion input from MPS output.
   *
   * Transforms MPS product results into the BomExplosionInput format,
   * loads active BOM lines, and builds the product types map.
   */
  private async prepareBomExplosionInput(
    mpsOutput: MpsOutput,
  ): Promise<BomExplosionInput> {
    // Convert MPS demands to TimePhasedDemand map
    const mpsRequirements = new Map<string, TimePhasedDemand[]>();
    for (const [produtoId, productResult] of mpsOutput.products) {
      const demands: TimePhasedDemand[] = productResult.demandBuckets.map((b) => ({
        periodStart: b.periodStart,
        periodEnd: b.periodEnd,
        quantity: b.mpsDemand,
      }));
      mpsRequirements.set(produtoId, demands);
    }

    // Load active BOM lines
    const bomLinesRaw = await this.prisma.bom.findMany({
      where: { ativo: true },
      select: {
        produtoPaiId: true,
        produtoFilhoId: true,
        quantidade: true,
        perdaPercentual: true,
      },
    });

    const bomLines: BomLineInput[] = bomLinesRaw.map((line: any) => ({
      produtoPaiId: line.produtoPaiId,
      produtoFilhoId: line.produtoFilhoId,
      quantidade: typeof line.quantidade === 'number'
        ? line.quantidade
        : Number(line.quantidade),
      perdaPercentual: typeof line.perdaPercentual === 'number'
        ? line.perdaPercentual
        : Number(line.perdaPercentual ?? 0),
    }));

    // Build product types map
    const allProductIds = new Set<string>();
    for (const line of bomLines) {
      allProductIds.add(line.produtoPaiId);
      allProductIds.add(line.produtoFilhoId);
    }
    for (const produtoId of mpsRequirements.keys()) {
      allProductIds.add(produtoId);
    }

    const products = await this.prisma.produto.findMany({
      where: { id: { in: [...allProductIds] } },
      select: { id: true, tipoProduto: true },
    });

    const productTypes = new Map<string, string>();
    for (const product of products) {
      productTypes.set(product.id, product.tipoProduto);
    }

    return {
      mpsRequirements,
      bomLines,
      productTypes,
    };
  }

  /**
   * Load stock parameters for all products in a given execution.
   * Returns a map of produtoId -> safetyStock.
   */
  private async loadStockParamsMap(
    execucaoId: string,
    productIds: string[],
  ): Promise<Map<string, number>> {
    if (productIds.length === 0) {
      return new Map();
    }

    const records = await this.prisma.parametrosEstoque.findMany({
      where: {
        execucaoId,
        produtoId: { in: productIds },
      },
      select: {
        produtoId: true,
        safetyStock: true,
      },
    });

    const map = new Map<string, number>();
    for (const record of records) {
      map.set(record.produtoId, Number(record.safetyStock));
    }
    return map;
  }

  /**
   * Load stock parameter records for lot sizing (EOQ values).
   * Returns a map of produtoId -> { eoq }.
   */
  private async loadStockParamsRecords(
    execucaoId: string,
  ): Promise<Map<string, { eoq: number }>> {
    const records = await this.prisma.parametrosEstoque.findMany({
      where: { execucaoId },
      select: {
        produtoId: true,
        eoq: true,
      },
    });

    const map = new Map<string, { eoq: number }>();
    for (const record of records) {
      map.set(record.produtoId, {
        eoq: Number(record.eoq),
      });
    }
    return map;
  }

  /**
   * Load product data needed for lot sizing.
   * Returns a map of produtoId -> lot sizing parameters.
   */
  private async loadProductLotSizingData(
    productIds: string[],
  ): Promise<
    Map<
      string,
      {
        lotificacao: string;
        loteMinimo: number;
        multiploCompra: number;
        moq: number;
        leadTimePeriods: number;
        custoPedido: number;
        holdingCostPerUnit: number;
      }
    >
  > {
    if (productIds.length === 0) {
      return new Map();
    }

    const products = await (this.prisma.produto as any).findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        lotificacao: true,
        loteMinimo: true,
        multiploCompra: true,
        leadTimeProducaoDias: true,
        custoUnitario: true,
        custoPedido: true,
        custoManutencaoPctAno: true,
      },
    }) as any[];

    // Load MOQ from supplier for each product
    const supplierData = await this.prisma.produtoFornecedor.findMany({
      where: {
        produtoId: { in: productIds },
        isPrincipal: true,
      },
      select: {
        produtoId: true,
        moq: true,
        leadTimeDias: true,
      },
    });

    const moqMap = new Map<string, { moq: number; leadTimeDias: number }>();
    for (const s of supplierData) {
      moqMap.set(s.produtoId, {
        moq: Number(s.moq ?? 1),
        leadTimeDias: s.leadTimeDias ?? 0,
      });
    }

    const map = new Map<
      string,
      {
        lotificacao: string;
        loteMinimo: number;
        multiploCompra: number;
        moq: number;
        leadTimePeriods: number;
        custoPedido: number;
        holdingCostPerUnit: number;
      }
    >();

    for (const product of products) {
      const supplier = moqMap.get(product.id);
      const custoUnitario = Number(product.custoUnitario ?? 0);
      const custoManutPct = Number(product.custoManutencaoPctAno ?? 25);
      const h = custoUnitario * custoManutPct / 100 / 52; // per week

      // Lead time in weekly periods
      const leadTimeDias = supplier?.leadTimeDias ?? product.leadTimeProducaoDias ?? 0;
      const leadTimePeriods = Math.ceil(leadTimeDias / 7);

      map.set(product.id, {
        lotificacao: (product as any).lotificacao ?? 'L4L',
        loteMinimo: Number(product.loteMinimo ?? 1),
        multiploCompra: Number(product.multiploCompra ?? 1),
        moq: supplier?.moq ?? 1,
        leadTimePeriods,
        custoPedido: Number(product.custoPedido ?? 0),
        holdingCostPerUnit: Math.round(h * 10000) / 10000,
      });
    }

    return map;
  }

  /**
   * Load product types for a list of product IDs.
   */
  private async loadProductTypesMap(productIds: string[]): Promise<Map<string, string>> {
    if (productIds.length === 0) {
      return new Map();
    }

    const products = await this.prisma.produto.findMany({
      where: { id: { in: productIds } },
      select: { id: true, tipoProduto: true },
    });

    const map = new Map<string, string>();
    for (const p of products) {
      map.set(p.id, p.tipoProduto);
    }
    return map;
  }

  /**
   * Get lotificacao method for a single product.
   */
  private async getProductLotificacao(produtoId: string): Promise<string | null> {
    const product = await (this.prisma.produto as any).findUnique({
      where: { id: produtoId },
      select: { lotificacao: true },
    });
    return (product as any)?.lotificacao ?? null;
  }

  /**
   * Build weekly time buckets from MPS output.
   * Extracts the period structure from the first product's demand buckets.
   */
  private buildWeeklyBucketsFromMps(
    mpsOutput: MpsOutput,
  ): { periodStart: Date; periodEnd: Date }[] {
    const firstProduct = mpsOutput.products.values().next().value;
    if (!firstProduct || firstProduct.demandBuckets.length === 0) {
      // Generate fallback buckets using MPS service
      const startDate = this.mpsService.getStartOfWeek(new Date());
      return this.mpsService.generateWeeklyBuckets(
        startDate,
        mpsOutput.planningHorizonWeeks,
      );
    }

    return firstProduct.demandBuckets.map((b) => ({
      periodStart: b.periodStart,
      periodEnd: b.periodEnd,
    }));
  }

  // ────────────────────────────────────────────────────────────────
  // Lot Sizing Cost Comparison (Story 5.1 — FR-064)
  // ────────────────────────────────────────────────────────────────

  /**
   * Compare all 4 lot sizing methods for a product.
   *
   * Loads the product's net requirements from the most recent MRP execution,
   * then runs L4L, EOQ, Silver-Meal, and Wagner-Whitin with the same input.
   * Returns cost analysis for each method plus a recommendation.
   *
   * @param produtoId - Product UUID
   * @returns Array of method comparisons with recommendation
   * @throws NotFoundException if product or recent execution not found
   */
  async compareLotSizing(produtoId: string): Promise<{
    readonly produtoId: string;
    readonly methods: readonly {
      readonly method: string;
      readonly totalCost: number;
      readonly orderingCost: number;
      readonly holdingCost: number;
      readonly numberOfOrders: number;
      readonly avgOrderQty: number;
    }[];
    readonly recommendation: string;
  }> {
    // Load product lot sizing data
    const productDataMap = await this.loadProductLotSizingData([produtoId]);
    const productData = productDataMap.get(produtoId);
    if (!productData) {
      throw new NotFoundException(`Product ${produtoId} not found`);
    }

    // Load latest completed execution
    const latestExecution = await this.prisma.execucaoPlanejamento.findFirst({
      where: { status: 'CONCLUIDO' },
      orderBy: { completedAt: 'desc' },
      select: { id: true },
    });

    if (!latestExecution) {
      throw new NotFoundException('No completed MRP execution found. Run MRP first.');
    }

    // Reconstruct net requirements from forecast results (p50 as weekly demand)
    // and on-hand inventory for the first period
    const forecastRows = await this.prisma.forecastResultado.findMany({
      where: {
        execucaoId: latestExecution.id,
        produtoId,
        targetType: 'VOLUME',
      },
      orderBy: { periodo: 'asc' },
      select: { periodo: true, p50: true },
      take: 104,
    });

    if (forecastRows.length === 0) {
      throw new NotFoundException(`No forecast data for product ${produtoId}. Run MRP first.`);
    }

    // Load on-hand inventory (sum across all depots)
    const inventoryAgg = await this.prisma.inventarioAtual.aggregate({
      where: { produtoId },
      _sum: { quantidadeDisponivel: true },
    });
    let onHand = Number(inventoryAgg._sum.quantidadeDisponivel ?? 0);

    // Build net requirements: gross demand (p50) minus on-hand for first periods
    const netRequirements = forecastRows.map((row) => {
      const grossDemand = Math.max(0, Number(row.p50 ?? 0));
      const netReq = Math.max(0, grossDemand - onHand);
      onHand = Math.max(0, onHand - grossDemand);

      const periodStart = new Date(row.periodo);
      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 6);

      return { periodStart, periodEnd, quantity: netReq };
    });

    // Load EOQ from stock params
    const stockParamsRecords = await this.loadStockParamsRecords(latestExecution.id);
    const stockParams = stockParamsRecords.get(produtoId);

    const methods: ('L4L' | 'EOQ' | 'SILVER_MEAL' | 'WAGNER_WHITIN')[] = [
      'L4L', 'EOQ', 'SILVER_MEAL', 'WAGNER_WHITIN',
    ];

    const K = productData.custoPedido;
    const h = productData.holdingCostPerUnit;

    const results = methods.map((method) => {
      const input: LotSizingInput = {
        produtoId,
        netRequirements,
        method,
        eoqValue: stockParams?.eoq ?? 0,
        loteMinimo: productData.loteMinimo,
        multiploCompra: productData.multiploCompra,
        moq: productData.moq,
        leadTimePeriods: productData.leadTimePeriods,
        orderingCost: K,
        holdingCostPerUnit: h,
      };

      const output = this.lotSizingService.calculateLotSizing(input);
      const numberOfOrders = output.plannedOrderReceipts.length;
      const totalOrderQty = output.plannedOrderReceipts.reduce(
        (sum, r) => sum + r.quantity,
        0,
      );

      // Calculate actual costs for comparison
      const orderingCostTotal = Math.round(numberOfOrders * K * 100) / 100;
      const holdingCostTotal = this.calculateHoldingCost(
        output,
        netRequirements,
        h,
      );
      const totalCost = Math.round((orderingCostTotal + holdingCostTotal) * 100) / 100;

      return {
        method,
        totalCost,
        orderingCost: orderingCostTotal,
        holdingCost: holdingCostTotal,
        numberOfOrders,
        avgOrderQty: numberOfOrders > 0
          ? Math.round((totalOrderQty / numberOfOrders) * 100) / 100
          : 0,
      };
    });

    // Find the method with the lowest total cost
    const recommendation = results.reduce(
      (best, curr) => (curr.totalCost < best.totalCost ? curr : best),
      results[0],
    ).method;

    return { produtoId, methods: results, recommendation };
  }

  /**
   * Calculate total holding cost for a lot sizing solution.
   * For each planned receipt, compute inventory held across periods until consumed.
   */
  private calculateHoldingCost(
    output: LotSizingOutput,
    netRequirements: readonly { readonly quantity: number }[],
    h: number,
  ): number {
    let totalHolding = 0;
    let inventory = 0;

    // Simple simulation: walk through periods, add receipts, subtract demands
    const receiptMap = new Map<number, number>();
    for (const receipt of output.plannedOrderReceipts) {
      receiptMap.set(receipt.periodIndex, (receiptMap.get(receipt.periodIndex) ?? 0) + receipt.quantity);
    }

    for (let t = 0; t < netRequirements.length; t++) {
      inventory += receiptMap.get(t) ?? 0;
      inventory -= netRequirements[t].quantity;
      if (inventory > 0) {
        totalHolding += h * inventory;
      }
    }

    return Math.round(totalHolding * 100) / 100;
  }
}
