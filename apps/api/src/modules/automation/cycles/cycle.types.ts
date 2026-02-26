/**
 * Re-training Cycle Management — Types & Interfaces
 *
 * @see Story 4.5 — AC-1 through AC-4
 */

export type CycleType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'MANUAL';

export type CycleStatus = 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'RUNNING' | 'PENDING';

export interface CycleStep {
  readonly name: string;
  readonly description: string;
  readonly order: number;
  readonly timeoutMs: number;
}

export interface CycleDefinition {
  readonly type: CycleType;
  readonly label: string;
  readonly description: string;
  readonly steps: readonly CycleStep[];
  readonly estimatedMinutes: number;
  readonly defaultCron: string;
}

export interface CycleScheduleConfig {
  readonly daily: string;
  readonly weekly: string;
  readonly monthly: string;
}

export interface CycleExecution {
  readonly id: string;
  readonly type: CycleType;
  readonly status: CycleStatus;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly errorMessage: string | null;
  readonly stepsCompleted: number;
  readonly stepsTotal: number;
  readonly resultSummary: Record<string, unknown> | null;
  readonly createdAt: Date;
}

export interface CycleExecutionDetail extends CycleExecution {
  readonly steps: readonly CycleStepLog[];
}

export interface CycleStepLog {
  readonly id: string;
  readonly stepName: string;
  readonly stepOrder: number;
  readonly status: string;
  readonly recordsProcessed: number | null;
  readonly durationMs: number | null;
  readonly details: Record<string, unknown> | null;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
}

export interface CycleScheduleInfo {
  readonly type: CycleType;
  readonly label: string;
  readonly cronExpression: string;
  readonly nextRunAt: Date | null;
  readonly lastExecution: {
    readonly id: string;
    readonly status: CycleStatus;
    readonly startedAt: Date | null;
    readonly completedAt: Date | null;
    readonly durationMs: number | null;
  } | null;
}

/** Maps CycleType to TipoExecucao enum values */
export const CYCLE_TYPE_TO_TIPO_EXECUCAO = {
  DAILY: 'CICLO_DIARIO',
  WEEKLY: 'CICLO_SEMANAL',
  MONTHLY: 'CICLO_MENSAL',
  MANUAL: 'CICLO_MENSAL',
} as const;

/** Maps TipoExecucao back to CycleType */
export const TIPO_EXECUCAO_TO_CYCLE_TYPE: Record<string, CycleType> = {
  CICLO_DIARIO: 'DAILY',
  CICLO_SEMANAL: 'WEEKLY',
  CICLO_MENSAL: 'MONTHLY',
};

/** Maps StatusExecucao to CycleStatus */
export const STATUS_MAP: Record<string, CycleStatus> = {
  PENDENTE: 'PENDING',
  EXECUTANDO: 'RUNNING',
  CONCLUIDO: 'SUCCESS',
  ERRO: 'FAILED',
  PARCIAL: 'PARTIAL',
};

/** Cycle type priority (higher number = higher priority) */
export const CYCLE_PRIORITY: Record<CycleType, number> = {
  DAILY: 1,
  WEEKLY: 2,
  MONTHLY: 3,
  MANUAL: 3,
};
