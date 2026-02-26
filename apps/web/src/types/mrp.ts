/**
 * MRP Dashboard types.
 *
 * All interfaces use readonly properties to enforce immutability.
 *
 * @see Story 3.12 — MRP & Capacity Dashboards
 */

// Re-export shared MRP types
export type { MrpExecution, PrioridadeOrdem } from './purchasing';

// ─────────────────────────────────────────────────────
// Planned Orders (Gantt & Detail)
// ─────────────────────────────────────────────────────

export type TipoOrdem = 'COMPRA' | 'PRODUCAO';

export interface PlannedOrder {
  readonly id: string;
  readonly execucaoId: string;
  readonly produtoId: string;
  readonly tipo: TipoOrdem;
  readonly quantidade: number;
  readonly dataNecessidade: string;
  readonly dataLiberacao: string;
  readonly dataRecebimentoEsperado: string;
  readonly fornecedorId: string | null;
  readonly centroTrabalhoId: string | null;
  readonly custoEstimado: number | null;
  readonly lotificacaoUsada: string | null;
  readonly prioridade: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA';
  readonly status: string;
  readonly produto?: {
    readonly codigo: string;
    readonly descricao: string;
  };
  readonly fornecedor?: {
    readonly razaoSocial: string;
  } | null;
  readonly centroTrabalho?: {
    readonly codigo: string;
    readonly nome: string;
  } | null;
}

// ─────────────────────────────────────────────────────
// MRP Grid (Detail Page)
// ─────────────────────────────────────────────────────

export interface MrpPeriodData {
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly grossRequirement: number;
  readonly scheduledReceipts: number;
  readonly projectedStock: number;
  readonly netRequirement: number;
  readonly plannedOrderReceipts: number;
}

export interface MrpGridData {
  readonly produtoId: string;
  readonly produtoCodigo: string;
  readonly produtoDescricao: string;
  readonly periods: readonly MrpPeriodData[];
}

// ─────────────────────────────────────────────────────
// Stock Parameters
// ─────────────────────────────────────────────────────

export interface StockParams {
  readonly id: string;
  readonly execucaoId: string;
  readonly produtoId: string;
  readonly safetyStock: number;
  readonly reorderPoint: number;
  readonly estoqueMinimo: number;
  readonly estoqueMaximo: number;
  readonly eoq: number;
  readonly metodoCalculo: string;
  readonly nivelServicoUsado: number;
  readonly calculatedAt: string;
  readonly produto?: {
    readonly codigo: string;
    readonly descricao: string;
  };
}

// ─────────────────────────────────────────────────────
// Capacity (CRP)
// ─────────────────────────────────────────────────────

export type SugestaoCapacidade = 'OK' | 'HORA_EXTRA' | 'ANTECIPAR' | 'SUBCONTRATAR';

export interface CapacityWeekRecord {
  readonly id: string;
  readonly execucaoId: string;
  readonly centroTrabalhoId: string;
  readonly periodStart: string;
  readonly capacidadeDisponivelHoras: number;
  readonly cargaPlanejadaHoras: number;
  readonly utilizacaoPercentual: number;
  readonly sobrecarga: boolean;
  readonly horasExcedentes: number;
  readonly sugestao: SugestaoCapacidade | null;
  readonly centroTrabalho?: {
    readonly codigo: string;
    readonly nome: string;
  };
}

// ─────────────────────────────────────────────────────
// Storage Validation (Warehouse Gauge)
// ─────────────────────────────────────────────────────

export type StorageAlertSeverity = 'OK' | 'ALERT' | 'CRITICAL';

export interface StorageWeekRecord {
  readonly periodStart: string;
  readonly projectedVolumeM3: number;
  readonly capacityM3: number;
  readonly utilizationPercentual: number;
  readonly severity: StorageAlertSeverity;
}

export interface StorageDepositoRecord {
  readonly depositoId: string;
  readonly codigo: string;
  readonly nome: string;
  readonly weeklyResults: readonly StorageWeekRecord[];
  readonly hasAlert: boolean;
  readonly hasCritical: boolean;
}

// ─────────────────────────────────────────────────────
// Gantt Chart Data
// ─────────────────────────────────────────────────────

export interface GanttBar {
  readonly orderId: string;
  readonly produtoCodigo: string;
  readonly produtoDescricao: string;
  readonly tipo: TipoOrdem;
  readonly quantidade: number;
  readonly dataLiberacao: string;
  readonly dataNecessidade: string;
  readonly custoEstimado: number | null;
  readonly prioridade: string;
  readonly fornecedorNome: string | null;
  readonly centroTrabalhoNome: string | null;
}

// ─────────────────────────────────────────────────────
// Overload Alert
// ─────────────────────────────────────────────────────

export interface OverloadAlert {
  readonly centroTrabalhoId: string;
  readonly centroTrabalhoCodigo: string;
  readonly centroTrabalhoNome: string;
  readonly periodStart: string;
  readonly utilizacaoPercentual: number;
  readonly horasExcedentes: number;
  readonly sugestao: SugestaoCapacidade;
}

// ─────────────────────────────────────────────────────
// Filter types
// ─────────────────────────────────────────────────────

export interface MrpOrderFilters {
  readonly execucaoId?: string;
  readonly tipo?: TipoOrdem;
  readonly produtoId?: string;
  readonly prioridade?: string;
  readonly page?: number;
  readonly limit?: number;
}

export interface MrpCapacityFilters {
  readonly execucaoId?: string;
  readonly centroTrabalhoId?: string;
  readonly page?: number;
  readonly limit?: number;
}

export interface MrpStockParamsFilters {
  readonly execucaoId?: string;
  readonly produtoId?: string;
  readonly page?: number;
  readonly limit?: number;
}
