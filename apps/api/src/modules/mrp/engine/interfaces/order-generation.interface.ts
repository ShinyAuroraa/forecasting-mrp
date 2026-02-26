/**
 * Order Generation Interfaces
 *
 * Core data structures for the Planned Order Generation engine.
 * Used by OrderGenerationService to create planned purchase (COMPRA) and
 * production (PRODUCAO) orders from lot-sized net requirements, enrich them
 * with supplier/routing data, and persist them to the database.
 *
 * @see Story 3.7 — Planned Order Generation
 * @see FR-038 — Order Generation
 */

/**
 * A single planned order input derived from lot-sized net requirements.
 * Represents one demand line that needs to be converted into either
 * a COMPRA or PRODUCAO order based on the product type.
 */
export interface PlannedOrderInput {
  /** The product identifier */
  readonly produtoId: string;

  /** Product type (TipoProduto enum value) — determines COMPRA vs PRODUCAO */
  readonly tipoProduto: string;

  /** Planned order quantity (after lot sizing and constraints) */
  readonly quantity: number;

  /** Date when the material is needed */
  readonly dataNecessidade: Date;

  /** Lot sizing method used to compute this quantity (optional) */
  readonly lotificacaoUsada?: string;
}

/**
 * Input for the order generation process.
 * Contains the execution context and all planned order inputs to process.
 */
export interface OrderGenerationInput {
  /** The planning execution identifier — all generated orders link to this */
  readonly execucaoId: string;

  /** Array of planned order inputs from the lot sizing engine */
  readonly plannedOrders: readonly PlannedOrderInput[];

  /** Reference date for priority calculation (defaults to current date) */
  readonly referenceDate?: Date;
}

/**
 * A fully enriched generated order ready for persistence.
 * Contains all fields needed to create an OrdemPlanejada record.
 */
export interface GeneratedOrder {
  /** The product identifier */
  readonly produtoId: string;

  /** Order type: COMPRA for purchased items, PRODUCAO for produced items */
  readonly tipo: 'COMPRA' | 'PRODUCAO';

  /** Planned order quantity */
  readonly quantidade: number;

  /** Date when the material is needed */
  readonly dataNecessidade: Date;

  /** Date when the order should be released (dataNecessidade - leadTimeDias) */
  readonly dataLiberacao: Date;

  /** Expected receipt date (same as dataNecessidade for now) */
  readonly dataRecebimentoEsperado: Date;

  /** Supplier identifier (COMPRA orders only) */
  readonly fornecedorId: string | null;

  /** Work center identifier (PRODUCAO orders only, from first routing step) */
  readonly centroTrabalhoId: string | null;

  /** Estimated cost (qty * precoUnitario for COMPRA, hours * custoHora for PRODUCAO) */
  readonly custoEstimado: number | null;

  /** Lot sizing method used */
  readonly lotificacaoUsada: string | null;

  /** Priority based on release date vs reference date */
  readonly prioridade: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA';

  /** All generated orders start as PLANEJADA */
  readonly status: 'PLANEJADA';

  /** Non-blocking warnings encountered during generation */
  readonly warnings: readonly string[];
}

/**
 * Output of the order generation process.
 * Contains all generated orders and summary statistics.
 */
export interface OrderGenerationOutput {
  /** The planning execution identifier */
  readonly execucaoId: string;

  /** All generated orders (both COMPRA and PRODUCAO) */
  readonly orders: readonly GeneratedOrder[];

  /** Count of COMPRA orders generated */
  readonly totalCompraOrders: number;

  /** Count of PRODUCAO orders generated */
  readonly totalProducaoOrders: number;

  /** Sum of all custoEstimado values across all orders */
  readonly totalCustoEstimado: number;

  /** Non-blocking warnings accumulated across all orders */
  readonly warnings: readonly string[];
}
