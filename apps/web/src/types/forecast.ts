export interface PaginationMeta {
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  readonly data: T[];
  readonly meta: PaginationMeta;
}

export type JobType = 'train_model' | 'run_forecast' | 'run_backtest';
export type ExecutionStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface ForecastExecution {
  readonly id: string;
  readonly jobType: JobType;
  readonly status: ExecutionStatus;
  readonly produtoIds: string[] | null;
  readonly modelo: string | null;
  readonly horizonteSemanas: number;
  readonly holdoutWeeks: number;
  readonly forceRetrain: boolean;
  readonly progress: number;
  readonly currentStep: string | null;
  readonly errorMessage: string | null;
  readonly durationSeconds: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
}

export interface ExecutionStep {
  readonly id: string;
  readonly executionId: string;
  readonly step: number;
  readonly stepName: string;
  readonly status: string;
  readonly productsProcessed: number;
  readonly productsTotal: number;
  readonly startedAt: string;
  readonly completedAt: string | null;
}

export interface ExecutionWithSteps extends ForecastExecution {
  readonly steps: ExecutionStep[];
}

export interface ForecastMetric {
  readonly id: string;
  readonly executionId: string;
  readonly produtoId: string;
  readonly modelName: string;
  readonly classeAbc: string | null;
  readonly mape: number;
  readonly mae: number;
  readonly rmse: number;
  readonly bias: number;
  readonly isBaseline: boolean;
  readonly createdAt: string;
}

export interface ForecastModelMeta {
  readonly id: string;
  readonly modelName: string;
  readonly version: number;
  readonly parameters: Record<string, unknown> | null;
  readonly trainingMetrics: Record<string, number> | null;
  readonly isChampion: boolean;
  readonly trainedAt: string;
  readonly createdAt: string;
}

export interface ExecuteForecastRequest {
  readonly jobType: JobType;
  readonly produtoIds?: string[];
  readonly modelo?: string;
  readonly horizonteSemanas?: number;
  readonly holdoutWeeks?: number;
  readonly forceRetrain?: boolean;
}
