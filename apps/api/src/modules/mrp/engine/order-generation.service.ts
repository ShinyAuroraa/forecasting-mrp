import { Injectable, Logger } from '@nestjs/common';

import type { Lotificacao } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  GeneratedOrder,
  OrderGenerationInput,
  OrderGenerationOutput,
  PlannedOrderInput,
} from './interfaces/order-generation.interface';

/**
 * Product types classified as PURCHASED items — generate COMPRA orders.
 */
const PURCHASED_TYPES: ReadonlySet<string> = new Set([
  'MATERIA_PRIMA',
  'INSUMO',
  'EMBALAGEM',
  'REVENDA',
]);

/**
 * Product types classified as PRODUCED items — generate PRODUCAO orders.
 */
const PRODUCED_TYPES: ReadonlySet<string> = new Set([
  'ACABADO',
  'SEMI_ACABADO',
]);

/**
 * Number of milliseconds in one day — used for date arithmetic.
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Decimal precision for rounding (4 decimal places).
 */
const DECIMAL_PLACES = 4;
const ROUNDING_FACTOR = Math.pow(10, DECIMAL_PLACES);

/**
 * Supplier information resolved from ProdutoFornecedor and Fornecedor.
 */
interface SupplierInfo {
  readonly fornecedorId: string;
  readonly leadTimeDias: number;
  readonly precoUnitario: number | null;
}

/**
 * Routing step information resolved from RoteiroProducao and CentroTrabalho.
 */
interface RoutingStepInfo {
  readonly centroTrabalhoId: string;
  readonly sequencia: number;
  readonly tempoSetupMinutos: number;
  readonly tempoUnitarioMinutos: number;
  readonly custoHora: number | null;
}

/**
 * OrderGenerationService — Planned Order Generation Engine
 *
 * Generates planned purchase (COMPRA) and production (PRODUCAO) orders from
 * lot-sized net requirements. Enriches orders with supplier data, routing data,
 * lead times, cost estimates, and priority classification. Persists all
 * generated orders to the database via Prisma.
 *
 * Key design decisions:
 *   - AC-1: Creates planned orders from lot-sized net requirements
 *   - AC-2: PURCHASED items (MATERIA_PRIMA, INSUMO, EMBALAGEM, REVENDA) → COMPRA
 *   - AC-3: PRODUCED items (ACABADO, SEMI_ACABADO) → PRODUCAO
 *   - AC-4: Supplier selected from ProdutoFornecedor (isPrincipal first, then lowest price)
 *   - AC-5: COMPRA cost = quantity * precoUnitario
 *   - AC-6: PRODUCAO centroTrabalhoId from first RoteiroProducao step (lowest sequencia)
 *   - AC-7: PRODUCAO cost = (setup + qty * unitTime) / 60 * custoHora
 *   - AC-8: dataLiberacao = dataNecessidade - leadTimeDias
 *   - AC-9: Priority based on dataLiberacao vs referenceDate (4 levels)
 *   - AC-10: All orders linked to execucaoId
 *   - AC-11: Orders persisted with status = PLANEJADA
 *
 * @see Story 3.7 — Planned Order Generation
 * @see FR-038 — Order Generation
 */
@Injectable()
export class OrderGenerationService {
  private readonly logger = new Logger(OrderGenerationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate planned orders from lot-sized net requirements.
   *
   * For each planned order input, determines whether to create a COMPRA or
   * PRODUCAO order based on the product type, enriches with supplier/routing
   * data, calculates costs and priorities, and persists all orders to the database.
   *
   * @param input - Execution context and planned order inputs
   * @returns Generated orders with summary statistics
   */
  async generateOrders(input: OrderGenerationInput): Promise<OrderGenerationOutput> {
    const referenceDate = input.referenceDate ?? new Date();
    const allWarnings: string[] = [];
    const generatedOrders: GeneratedOrder[] = [];

    this.logger.log(
      `Starting order generation for execucao ${input.execucaoId}: ` +
        `${input.plannedOrders.length} planned order(s) to process`,
    );

    for (const plannedOrder of input.plannedOrders) {
      if (this.isPurchasedItem(plannedOrder.tipoProduto)) {
        const order = await this.generateCompraOrder(plannedOrder, referenceDate);
        generatedOrders.push(order);
        allWarnings.push(...order.warnings);
      } else if (this.isProducedItem(plannedOrder.tipoProduto)) {
        const order = await this.generateProducaoOrder(plannedOrder, referenceDate);
        generatedOrders.push(order);
        allWarnings.push(...order.warnings);
      } else {
        const warning =
          `Unknown tipoProduto "${plannedOrder.tipoProduto}" for product ${plannedOrder.produtoId} — skipping`;
        this.logger.warn(warning);
        allWarnings.push(warning);
      }
    }

    // Persist all generated orders to the database (AC-11)
    if (generatedOrders.length > 0) {
      const ordersToCreate = generatedOrders.map((order) => ({
        execucaoId: input.execucaoId,
        produtoId: order.produtoId,
        tipo: order.tipo as 'COMPRA' | 'PRODUCAO',
        quantidade: order.quantidade,
        dataNecessidade: order.dataNecessidade,
        dataLiberacao: order.dataLiberacao,
        dataRecebimentoEsperado: order.dataRecebimentoEsperado,
        fornecedorId: order.fornecedorId,
        centroTrabalhoId: order.centroTrabalhoId,
        custoEstimado: order.custoEstimado,
        lotificacaoUsada: (order.lotificacaoUsada as Lotificacao) ?? null,
        prioridade: order.prioridade,
        status: 'PLANEJADA' as const,
      }));

      await this.prisma.ordemPlanejada.createMany({ data: ordersToCreate });

      this.logger.log(
        `Persisted ${generatedOrders.length} order(s) to ordem_planejada`,
      );
    }

    // Calculate summary statistics
    const totalCompraOrders = generatedOrders.filter((o) => o.tipo === 'COMPRA').length;
    const totalProducaoOrders = generatedOrders.filter((o) => o.tipo === 'PRODUCAO').length;
    const totalCustoEstimado = this.round(
      generatedOrders.reduce((sum, o) => sum + (o.custoEstimado ?? 0), 0),
    );

    this.logger.log(
      `Order generation complete: ${totalCompraOrders} COMPRA, ` +
        `${totalProducaoOrders} PRODUCAO, ` +
        `total estimated cost: ${totalCustoEstimado}`,
    );

    return {
      execucaoId: input.execucaoId,
      orders: generatedOrders,
      totalCompraOrders,
      totalProducaoOrders,
      totalCustoEstimado,
      warnings: allWarnings,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Type Classification (AC-2, AC-3)
  // ────────────────────────────────────────────────────────────────

  /**
   * Determine if a product type is a purchased item.
   * MATERIA_PRIMA, INSUMO, EMBALAGEM, REVENDA → COMPRA orders.
   */
  isPurchasedItem(tipoProduto: string): boolean {
    return PURCHASED_TYPES.has(tipoProduto);
  }

  /**
   * Determine if a product type is a produced item.
   * ACABADO, SEMI_ACABADO → PRODUCAO orders.
   */
  isProducedItem(tipoProduto: string): boolean {
    return PRODUCED_TYPES.has(tipoProduto);
  }

  // ────────────────────────────────────────────────────────────────
  // COMPRA Order Generation (AC-2, AC-4, AC-5, AC-8, AC-9)
  // ────────────────────────────────────────────────────────────────

  /**
   * Generate a COMPRA (purchase) order for a purchased item.
   *
   * Resolves supplier information (isPrincipal first, then lowest price),
   * calculates lead time offset for release date, estimates cost, and
   * assigns priority based on release date vs reference date.
   *
   * @param input - Planned order input with product and quantity details
   * @param referenceDate - Reference date for priority calculation ("today")
   * @returns Generated COMPRA order with supplier enrichment
   */
  private async generateCompraOrder(
    input: PlannedOrderInput,
    referenceDate: Date,
  ): Promise<GeneratedOrder> {
    const warnings: string[] = [];

    // Resolve supplier (AC-4)
    const supplier = await this.selectSupplier(input.produtoId);

    let fornecedorId: string | null = null;
    let leadTimeDias = 0;
    let custoEstimado: number | null = null;

    if (supplier !== null) {
      fornecedorId = supplier.fornecedorId;
      leadTimeDias = supplier.leadTimeDias;

      // Cost estimation (AC-5): qty * precoUnitario
      if (supplier.precoUnitario !== null) {
        custoEstimado = this.round(input.quantity * supplier.precoUnitario);
      } else {
        warnings.push(
          `No precoUnitario for supplier ${fornecedorId} of product ${input.produtoId} — cost not estimated`,
        );
      }
    } else {
      warnings.push(
        `No supplier found for product ${input.produtoId} — COMPRA order created without supplier`,
      );
    }

    // Release date (AC-8): dataNecessidade - leadTimeDias
    const dataLiberacao = this.calculateReleaseDate(input.dataNecessidade, leadTimeDias);

    // Priority (AC-9)
    const prioridade = this.assignPriority(dataLiberacao, referenceDate);

    return {
      produtoId: input.produtoId,
      tipo: 'COMPRA',
      quantidade: input.quantity,
      dataNecessidade: input.dataNecessidade,
      dataLiberacao,
      dataRecebimentoEsperado: input.dataNecessidade,
      fornecedorId,
      centroTrabalhoId: null,
      custoEstimado,
      lotificacaoUsada: input.lotificacaoUsada ?? null,
      prioridade,
      status: 'PLANEJADA',
      warnings,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // PRODUCAO Order Generation (AC-3, AC-6, AC-7, AC-8, AC-9)
  // ────────────────────────────────────────────────────────────────

  /**
   * Generate a PRODUCAO (production) order for a produced item.
   *
   * Loads routing steps to determine work center and calculate production
   * cost. Uses the product's leadTimeProducaoDias for release date offset.
   *
   * @param input - Planned order input with product and quantity details
   * @param referenceDate - Reference date for priority calculation ("today")
   * @returns Generated PRODUCAO order with routing enrichment
   */
  private async generateProducaoOrder(
    input: PlannedOrderInput,
    referenceDate: Date,
  ): Promise<GeneratedOrder> {
    const warnings: string[] = [];

    // Load routing steps (AC-6)
    const routingSteps = await this.loadRoutingSteps(input.produtoId);

    let centroTrabalhoId: string | null = null;
    let custoEstimado: number | null = null;
    let leadTimeDias = 0;

    if (routingSteps.length > 0) {
      // AC-6: centroTrabalhoId from first routing step (lowest sequencia)
      centroTrabalhoId = routingSteps[0].centroTrabalhoId;

      // AC-7: cost = sum of (setup + qty * unitTime) / 60 * custoHora for each step
      let totalCost = 0;
      let hasAnyCost = false;

      for (const step of routingSteps) {
        if (step.custoHora !== null) {
          const hours = this.round(
            (step.tempoSetupMinutos + input.quantity * step.tempoUnitarioMinutos) / 60,
          );
          totalCost += this.round(hours * step.custoHora);
          hasAnyCost = true;
        }
      }

      if (hasAnyCost) {
        custoEstimado = this.round(totalCost);
      } else {
        warnings.push(
          `No custoHora available for routing steps of product ${input.produtoId} — cost not estimated`,
        );
      }
    } else {
      warnings.push(
        `No routing steps found for product ${input.produtoId} — PRODUCAO order created without work center`,
      );
    }

    // Load product lead time for production
    const produto = await this.prisma.produto.findUnique({
      where: { id: input.produtoId },
      select: { leadTimeProducaoDias: true },
    });

    if (produto?.leadTimeProducaoDias !== null && produto?.leadTimeProducaoDias !== undefined) {
      leadTimeDias = produto.leadTimeProducaoDias;
    }

    // Release date (AC-8): dataNecessidade - leadTimeDias
    const dataLiberacao = this.calculateReleaseDate(input.dataNecessidade, leadTimeDias);

    // Priority (AC-9)
    const prioridade = this.assignPriority(dataLiberacao, referenceDate);

    return {
      produtoId: input.produtoId,
      tipo: 'PRODUCAO',
      quantidade: input.quantity,
      dataNecessidade: input.dataNecessidade,
      dataLiberacao,
      dataRecebimentoEsperado: input.dataNecessidade,
      fornecedorId: null,
      centroTrabalhoId,
      custoEstimado,
      lotificacaoUsada: input.lotificacaoUsada ?? null,
      prioridade,
      status: 'PLANEJADA',
      warnings,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Supplier Selection (AC-4)
  // ────────────────────────────────────────────────────────────────

  /**
   * Select the best supplier for a purchased product.
   *
   * Selection priority:
   *   1. isPrincipal = true (primary supplier)
   *   2. Lowest precoUnitario (fallback)
   *
   * Uses the supplier-level lead time from ProdutoFornecedor first,
   * falling back to Fornecedor.leadTimePadraoDias if not set.
   *
   * @param produtoId - The product identifier
   * @returns Supplier info or null if no supplier found
   */
  async selectSupplier(produtoId: string): Promise<SupplierInfo | null> {
    // First: try isPrincipal = true
    const principal = await this.prisma.produtoFornecedor.findFirst({
      where: { produtoId, isPrincipal: true },
      include: {
        fornecedor: {
          select: { leadTimePadraoDias: true },
        },
      },
    });

    if (principal !== null) {
      return this.mapSupplierResult(principal);
    }

    // Fallback: lowest precoUnitario
    const cheapest = await this.prisma.produtoFornecedor.findFirst({
      where: {
        produtoId,
        precoUnitario: { not: null },
      },
      orderBy: { precoUnitario: 'asc' },
      include: {
        fornecedor: {
          select: { leadTimePadraoDias: true },
        },
      },
    });

    if (cheapest !== null) {
      return this.mapSupplierResult(cheapest);
    }

    return null;
  }

  /**
   * Map a Prisma ProdutoFornecedor result to a SupplierInfo.
   * Resolves lead time from ProdutoFornecedor first, then Fornecedor default.
   */
  private mapSupplierResult(record: {
    fornecedorId: string;
    leadTimeDias?: number | null;
    precoUnitario?: unknown;
    fornecedor: { leadTimePadraoDias?: number | null };
  }): SupplierInfo {
    const leadTimeDias =
      record.leadTimeDias ?? record.fornecedor.leadTimePadraoDias ?? 0;

    const precoUnitario =
      record.precoUnitario !== null && record.precoUnitario !== undefined
        ? typeof record.precoUnitario === 'number'
          ? record.precoUnitario
          : (record.precoUnitario as { toNumber: () => number }).toNumber()
        : null;

    return {
      fornecedorId: record.fornecedorId,
      leadTimeDias,
      precoUnitario,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Routing Data (AC-6, AC-7)
  // ────────────────────────────────────────────────────────────────

  /**
   * Load routing steps for a produced product, ordered by sequencia.
   *
   * @param produtoId - The product identifier
   * @returns Array of routing steps with work center cost info
   */
  async loadRoutingSteps(produtoId: string): Promise<readonly RoutingStepInfo[]> {
    const steps = await this.prisma.roteiroProducao.findMany({
      where: { produtoId, ativo: true },
      orderBy: { sequencia: 'asc' },
      include: {
        centroTrabalho: {
          select: { custoHora: true },
        },
      },
    });

    return steps.map((step) => ({
      centroTrabalhoId: step.centroTrabalhoId,
      sequencia: step.sequencia,
      tempoSetupMinutos:
        typeof step.tempoSetupMinutos === 'number'
          ? step.tempoSetupMinutos
          : (step.tempoSetupMinutos as { toNumber: () => number }).toNumber(),
      tempoUnitarioMinutos:
        typeof step.tempoUnitarioMinutos === 'number'
          ? step.tempoUnitarioMinutos
          : (step.tempoUnitarioMinutos as { toNumber: () => number }).toNumber(),
      custoHora:
        step.centroTrabalho.custoHora !== null && step.centroTrabalho.custoHora !== undefined
          ? typeof step.centroTrabalho.custoHora === 'number'
            ? step.centroTrabalho.custoHora
            : (step.centroTrabalho.custoHora as { toNumber: () => number }).toNumber()
          : null,
    }));
  }

  // ────────────────────────────────────────────────────────────────
  // Date & Priority Calculations (AC-8, AC-9)
  // ────────────────────────────────────────────────────────────────

  /**
   * Calculate the release date by offsetting back from the need date.
   *
   * @param dataNecessidade - Date when material is needed
   * @param leadTimeDias - Lead time in calendar days
   * @returns Release date (dataNecessidade - leadTimeDias)
   */
  calculateReleaseDate(dataNecessidade: Date, leadTimeDias: number): Date {
    const releaseTime = dataNecessidade.getTime() - leadTimeDias * MS_PER_DAY;
    return new Date(releaseTime);
  }

  /**
   * Assign priority based on the release date relative to the reference date.
   *
   * Priority levels (AC-9):
   *   - CRITICA: dataLiberacao < referenceDate (past due — order should have been released)
   *   - ALTA: dataLiberacao < referenceDate + 7 days (urgent — within one week)
   *   - MEDIA: dataLiberacao < referenceDate + 14 days (moderate)
   *   - BAIXA: dataLiberacao >= referenceDate + 14 days (low priority)
   *
   * @param dataLiberacao - Calculated release date
   * @param referenceDate - Reference date ("today")
   * @returns Priority classification
   */
  assignPriority(
    dataLiberacao: Date,
    referenceDate: Date,
  ): 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA' {
    const releaseTime = dataLiberacao.getTime();
    const refTime = referenceDate.getTime();

    if (releaseTime < refTime) {
      return 'CRITICA';
    }

    if (releaseTime < refTime + 7 * MS_PER_DAY) {
      return 'ALTA';
    }

    if (releaseTime < refTime + 14 * MS_PER_DAY) {
      return 'MEDIA';
    }

    return 'BAIXA';
  }

  // ────────────────────────────────────────────────────────────────
  // Internal Helpers
  // ────────────────────────────────────────────────────────────────

  /**
   * Round to 4 decimal places to avoid floating-point precision issues.
   * Uses factor-based rounding for deterministic results.
   */
  private round(value: number): number {
    return Math.round(value * ROUNDING_FACTOR) / ROUNDING_FACTOR;
  }
}
