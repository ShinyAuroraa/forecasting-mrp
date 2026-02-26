/**
 * Daily Automated Pipeline — Types & Constants
 *
 * @see Story 4.6 — AC-1 through AC-22
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

export interface PipelineStepDef {
  readonly id: PipelineStepId;
  readonly name: string;
  readonly order: number;
  readonly dependsOn: readonly PipelineStepId[];
  readonly required: boolean;
  readonly timeoutMs: number;
}

export interface PipelineConfig {
  readonly cron: string;
  readonly steps: Record<PipelineStepId, { readonly enabled: boolean }>;
}

export interface PipelineStepResult {
  readonly stepId: PipelineStepId;
  readonly status: PipelineStepStatus;
  readonly durationMs: number | null;
  readonly details: Record<string, unknown> | null;
  readonly errorMessage: string | null;
}

export interface PipelineExecution {
  readonly id: string;
  readonly status: PipelineStatus;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly errorMessage: string | null;
  readonly stepsCompleted: number;
  readonly stepsTotal: number;
  readonly resultSummary: Record<string, unknown> | null;
  readonly createdAt: Date;
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

export const TIPO_EXECUCAO_PIPELINE = 'PIPELINE_DIARIO' as const;

export const PIPELINE_STATUS_MAP: Record<string, PipelineStatus> = {
  CONCLUIDO: 'COMPLETED',
  ERRO: 'FAILED',
  PARCIAL: 'PARTIAL',
  EXECUTANDO: 'RUNNING',
  PENDENTE: 'PENDING',
};

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  cron: '0 6 * * 1-5',
  steps: {
    'fetch-data': { enabled: true },
    'etl': { enabled: true },
    'update-stock': { enabled: true },
    'forecast': { enabled: true },
    'mrp': { enabled: true },
    'alerts': { enabled: true },
    'email': { enabled: true },
  },
};
