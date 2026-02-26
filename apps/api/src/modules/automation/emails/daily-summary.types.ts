/**
 * Daily Summary & Morning Briefing — Types & Constants
 *
 * @see Story 4.7 — AC-1 through AC-20
 */

export type EmailType = 'RESUMO_DIARIO' | 'BRIEFING_MATINAL';

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string;
  readonly pass: string;
  readonly fromAddress: string;
  readonly fromName: string;
}

export interface EmailRecipientsConfig {
  readonly summary: readonly string[];
  readonly briefing: readonly string[];
  readonly cc: readonly string[];
  readonly bcc: readonly string[];
}

export interface SkuAlert {
  readonly codigo: string;
  readonly descricao: string;
  readonly estoqueAtual: number;
  readonly estoqueSeguranca: number;
  readonly pontoReposicao: number;
  readonly severity: 'CRITICAL' | 'HIGH';
}

export interface SupplierSummary {
  readonly fornecedorNome: string;
  readonly totalPedidos: number;
  readonly valorTotal: number;
}

export interface CapacitySummary {
  readonly centroTrabalho: string;
  readonly utilizacaoPct: number;
  readonly status: 'NORMAL' | 'WARNING' | 'OVERLOADED';
}

export interface WeeklyMape {
  readonly weekLabel: string;
  readonly classeA: number | null;
  readonly classeB: number | null;
  readonly classeC: number | null;
}

export interface DailySummaryData {
  readonly date: string;
  readonly stockAlerts: {
    readonly belowSafetyStock: number;
    readonly approachingRop: number;
    readonly criticalSkus: readonly SkuAlert[];
  };
  readonly urgentPurchases: {
    readonly totalValue: number;
    readonly orderCount: number;
    readonly topSuppliers: readonly SupplierSummary[];
  };
  readonly capacity: {
    readonly overloadedCenters: readonly CapacitySummary[];
    readonly totalOverloadAlerts: number;
  };
  readonly forecastAccuracy: {
    readonly byClass: Record<string, number | null>;
    readonly weeklyTrend: readonly WeeklyMape[];
  };
  readonly pipelineSummary: {
    readonly stepsCompleted: number;
    readonly stepsFailed: number;
    readonly stepsSkipped: number;
    readonly durationMs: number;
  } | null;
}

export interface EmailSendResult {
  readonly success: boolean;
  readonly messageId: string | null;
  readonly recipients: readonly string[];
  readonly error: string | null;
}

export interface EmailHistoryEntry {
  readonly id: string;
  readonly tipo: EmailType;
  readonly destinatarios: readonly string[];
  readonly assunto: string;
  readonly statusEnvio: 'ENVIADO' | 'FALHA' | 'NOOP';
  readonly tentativas: number;
  readonly ultimoErro: string | null;
  readonly enviadoEm: Date | null;
  readonly criadoEm: Date;
}

export const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  user: '',
  pass: '',
  fromAddress: 'noreply@empresa.com',
  fromName: 'ForecastingMRP',
};

export const DEFAULT_RECIPIENTS_CONFIG: EmailRecipientsConfig = {
  summary: [],
  briefing: [],
  cc: [],
  bcc: [],
};

export const CONFIG_KEY_SMTP = 'automacao.email.smtp' as const;
export const CONFIG_KEY_RECIPIENTS = 'automacao.email.destinatarios' as const;
