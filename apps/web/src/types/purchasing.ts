/**
 * Purchasing Panel types.
 *
 * All interfaces use readonly properties to enforce immutability.
 *
 * @see Story 3.11 — Purchasing Panel
 */

export interface UrgentAction {
  readonly orderId: string;
  readonly produtoCodigo: string;
  readonly produtoDescricao: string;
  readonly quantidade: number;
  readonly fornecedorNome: string;
  readonly fornecedorId: string | null;
  readonly dataLiberacao: string;
  readonly dataNecessidade: string;
  readonly custoEstimado: number;
  readonly prioridade: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA';
  readonly mensagemAcao: string | null;
}

export interface CompraOrderSummary {
  readonly orderId: string;
  readonly produtoCodigo: string;
  readonly produtoDescricao: string;
  readonly quantidade: number;
  readonly custoEstimado: number;
  readonly dataLiberacao: string;
  readonly prioridade: string;
}

export interface SupplierSummary {
  readonly fornecedorId: string;
  readonly fornecedorNome: string;
  readonly totalOrders: number;
  readonly totalQuantidade: number;
  readonly totalCusto: number;
  readonly orders: readonly CompraOrderSummary[];
}

export interface PurchaseTotals {
  readonly totalPurchaseCost: number;
  readonly totalOrders: number;
  readonly urgentOrders: number;
  readonly averageLeadTimeDays: number;
}

export interface PurchasingPanelResponse {
  readonly execucaoId: string;
  readonly generatedAt: string;
  readonly urgentActions: readonly UrgentAction[];
  readonly supplierSummary: readonly SupplierSummary[];
  readonly totals: PurchaseTotals;
}

export interface MrpExecution {
  readonly id: string;
  readonly tipo: string;
  readonly status: string;
  readonly gatilho: string;
  readonly createdAt: string;
}

export type PrioridadeOrdem = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA';
