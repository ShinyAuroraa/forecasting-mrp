/**
 * Re-training Cycle Management — Frontend Types
 *
 * @see Story 4.5 — AC-14 through AC-16
 */

export type CycleType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'MANUAL';
export type CycleStatus = 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'RUNNING' | 'PENDING';

export interface CycleExecution {
  readonly id: string;
  readonly type: CycleType;
  readonly status: CycleStatus;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly errorMessage: string | null;
  readonly stepsCompleted: number;
  readonly stepsTotal: number;
  readonly resultSummary: Record<string, unknown> | null;
  readonly createdAt: string;
}

export interface CycleStepLog {
  readonly id: string;
  readonly stepName: string;
  readonly stepOrder: number;
  readonly status: string;
  readonly recordsProcessed: number | null;
  readonly durationMs: number | null;
  readonly details: Record<string, unknown> | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

export interface CycleExecutionDetail extends CycleExecution {
  readonly steps: readonly CycleStepLog[];
}

export interface CycleScheduleInfo {
  readonly type: CycleType;
  readonly label: string;
  readonly cronExpression: string;
  readonly nextRunAt: string | null;
  readonly lastExecution: {
    readonly id: string;
    readonly status: CycleStatus;
    readonly startedAt: string | null;
    readonly completedAt: string | null;
    readonly durationMs: number | null;
  } | null;
}

export interface CycleScheduleConfig {
  readonly daily: string;
  readonly weekly: string;
  readonly monthly: string;
}

export interface PaginatedCycleResponse {
  readonly data: readonly CycleExecution[];
  readonly meta: {
    readonly total: number;
    readonly page: number;
    readonly limit: number;
    readonly totalPages: number;
    readonly hasNext: boolean;
    readonly hasPrev: boolean;
  };
}

export const CYCLE_TYPE_LABELS: Record<CycleType, string> = {
  DAILY: 'Diario',
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensal',
  MANUAL: 'Manual',
};

export const CYCLE_STATUS_LABELS: Record<CycleStatus, string> = {
  SUCCESS: 'Sucesso',
  FAILED: 'Falha',
  PARTIAL: 'Parcial',
  RUNNING: 'Executando',
  PENDING: 'Pendente',
};

export const CYCLE_STATUS_COLORS: Record<CycleStatus, string> = {
  SUCCESS: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  PARTIAL: 'bg-yellow-100 text-yellow-800',
  RUNNING: 'bg-blue-100 text-blue-800',
  PENDING: 'bg-gray-100 text-gray-800',
};
