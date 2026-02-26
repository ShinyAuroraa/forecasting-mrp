export enum DriftStatus {
  STABLE = 'STABLE',
  WARNING = 'WARNING',
  DRIFTING = 'DRIFTING',
}

export interface DriftCheckResult {
  tipoModelo: string;
  status: DriftStatus;
  currentMape: number;
  rollingAvgMape: number;
  mapeIncreasePct: number;
  recentMapes: number[];
  checkedAt: string;
}

export interface DriftLog {
  status: DriftStatus;
  currentMape: number;
  rollingAvgMape: number;
  mapeIncreasePct: number;
  recentMapes: number[];
  checkedAt: string;
  retrainingTriggered: boolean;
}

/** Default: trigger WARNING at 10%, DRIFTING at 15% MAPE increase. */
export const DRIFT_WARNING_THRESHOLD = 0.10;
export const DRIFT_THRESHOLD = 0.15;
export const ROLLING_WINDOW_SIZE = 4;
export const MAX_MAPE_HISTORY = 8;
