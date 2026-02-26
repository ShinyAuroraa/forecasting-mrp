export enum ExecutionStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ForecastJobType {
  TRAIN_MODEL = 'train_model',
  RUN_FORECAST = 'run_forecast',
  RUN_BACKTEST = 'run_backtest',
}

export interface ForecastExecution {
  id: string;
  jobType: ForecastJobType;
  status: ExecutionStatus;
  produtoIds: string[] | null;
  modelo: string | null;
  horizonteSemanas: number;
  holdoutWeeks: number;
  forceRetrain: boolean;
  progress: number;
  currentStep: string | null;
  errorMessage: string | null;
  durationSeconds: number | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface ExecutionStep {
  id: string;
  executionId: string;
  step: number;
  stepName: string;
  status: string;
  productsProcessed: number;
  productsTotal: number;
  startedAt: Date;
  completedAt: Date | null;
}

export interface ExecutionWithSteps extends ForecastExecution {
  steps: ExecutionStep[];
}

export interface ForecastMetric {
  id: string;
  executionId: string;
  produtoId: string;
  modelName: string;
  classeAbc: string | null;
  mape: number;
  mae: number;
  rmse: number;
  bias: number;
  isBaseline: boolean;
  createdAt: Date;
}

export interface ForecastModelMeta {
  id: string;
  modelName: string;
  version: number;
  parameters: Record<string, unknown> | null;
  trainingMetrics: Record<string, number> | null;
  isChampion: boolean;
  trainedAt: Date;
  createdAt: Date;
}

export interface ChampionInfo {
  id: string;
  tipoModelo: string;
  versao: number;
  isChampion: boolean;
  metricasTreino: Record<string, unknown> | null;
  treinadoEm: Date | null;
  createdAt: Date;
}

export interface PromotionHistoryEntry {
  id: string;
  tipoModelo: string;
  versao: number;
  isChampion: boolean;
  metricasTreino: Record<string, unknown> | null;
  treinadoEm: Date | null;
  createdAt: Date;
}
