/**
 * Daily Automated Pipeline — Frontend Types
 *
 * @see Story 4.6 — AC-18 through AC-24
 */

export type PipelineStepId =
  | 'fetch-data'
  | 'etl'
  | 'update-stock'
  | 'forecast'
  | 'mrp'
  | 'alerts'
  | 'email';

export type PipelineStepStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
export type PipelineStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';

export interface PipelineExecution {
  readonly id: string;
  readonly status: PipelineStatus;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly errorMessage: string | null;
  readonly stepsCompleted: number;
  readonly stepsTotal: number;
  readonly resultSummary: Record<string, unknown> | null;
  readonly createdAt: string;
}

export interface PipelineStepResult {
  readonly stepId: PipelineStepId;
  readonly status: PipelineStepStatus;
  readonly durationMs: number | null;
  readonly details: Record<string, unknown> | null;
  readonly errorMessage: string | null;
}

export interface PipelineExecutionDetail extends PipelineExecution {
  readonly steps: readonly PipelineStepResult[];
}

export interface PipelineProgressEvent {
  readonly executionId: string;
  readonly stepId: PipelineStepId;
  readonly stepName: string;
  readonly stepOrder: number;
  readonly totalSteps: number;
  readonly status: PipelineStepStatus;
  readonly timestamp: string;
}

export interface PaginatedPipelineResponse {
  readonly data: readonly PipelineExecution[];
  readonly meta: {
    readonly total: number;
    readonly page: number;
    readonly limit: number;
    readonly totalPages: number;
    readonly hasNext: boolean;
    readonly hasPrev: boolean;
  };
}

export const PIPELINE_STEP_LABELS: Record<PipelineStepId, string> = {
  'fetch-data': 'Buscar Dados',
  'etl': 'ETL Incremental',
  'update-stock': 'Atualizar Estoque',
  'forecast': 'Inferencia Forecast',
  'mrp': 'Recalcular MRP',
  'alerts': 'Verificar Alertas',
  'email': 'Enviar Resumo',
};

export const PIPELINE_STATUS_LABELS: Record<PipelineStatus, string> = {
  PENDING: 'Pendente',
  RUNNING: 'Executando',
  COMPLETED: 'Concluido',
  PARTIAL: 'Parcial',
  FAILED: 'Falha',
};

export const PIPELINE_STATUS_COLORS: Record<PipelineStatus, string> = {
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  PARTIAL: 'bg-yellow-100 text-yellow-800',
  RUNNING: 'bg-blue-100 text-blue-800',
  PENDING: 'bg-gray-100 text-gray-800',
};

export const STEP_STATUS_COLORS: Record<PipelineStepStatus, string> = {
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  SKIPPED: 'bg-orange-100 text-orange-800',
  RUNNING: 'bg-blue-100 text-blue-800',
  PENDING: 'bg-gray-100 text-gray-800',
};
