import type { CycleDefinition } from './cycle.types';

/**
 * Cycle step definitions for each cycle type.
 *
 * @see Story 4.5 — AC-1 through AC-4
 */

export const DAILY_CYCLE: CycleDefinition = {
  type: 'DAILY',
  label: 'Ciclo Diario',
  description: 'Inference, MRP recalculation, alert check',
  estimatedMinutes: 2,
  defaultCron: '0 6 * * *',
  steps: [
    {
      name: 'RUN_INFERENCE',
      description: 'Run forecast inference (no training)',
      order: 1,
      timeoutMs: 60_000,
    },
    {
      name: 'RECALCULATE_MRP',
      description: 'Recalculate MRP based on latest forecast',
      order: 2,
      timeoutMs: 60_000,
    },
    {
      name: 'CHECK_ALERTS',
      description: 'Run alert detection for all alert types',
      order: 3,
      timeoutMs: 30_000,
    },
  ],
};

export const WEEKLY_CYCLE: CycleDefinition = {
  type: 'WEEKLY',
  label: 'Ciclo Semanal',
  description: 'Metrics update, ABC/XYZ reclassification, stock parameter refresh',
  estimatedMinutes: 10,
  defaultCron: '0 3 * * 1',
  steps: [
    {
      name: 'COMPARE_FORECAST_ACTUAL',
      description: 'Compare forecast vs actual sales',
      order: 1,
      timeoutMs: 120_000,
    },
    {
      name: 'UPDATE_MAPE',
      description: 'Update MAPE per SKU',
      order: 2,
      timeoutMs: 120_000,
    },
    {
      name: 'UPDATE_CLASSIFICATION',
      description: 'Recalculate ABC/XYZ classification',
      order: 3,
      timeoutMs: 180_000,
    },
    {
      name: 'UPDATE_STOCK_PARAMS',
      description: 'Update stock parameters based on new metrics',
      order: 4,
      timeoutMs: 180_000,
    },
  ],
};

export const MONTHLY_CYCLE: CycleDefinition = {
  type: 'MONTHLY',
  label: 'Ciclo Mensal',
  description: 'Full re-training, accuracy report, model metadata update',
  estimatedMinutes: 45,
  defaultCron: '0 2 1 * *',
  steps: [
    {
      name: 'RETRAIN_MODELS',
      description: 'Full re-training of ALL forecast models',
      order: 1,
      timeoutMs: 30 * 60_000,
    },
    {
      name: 'GENERATE_ACCURACY_REPORT',
      description: 'Generate accuracy comparison report',
      order: 2,
      timeoutMs: 5 * 60_000,
    },
    {
      name: 'UPDATE_MODEL_METADATA',
      description: 'Update model metadata with new training results',
      order: 3,
      timeoutMs: 2 * 60_000,
    },
  ],
};

export const CYCLE_DEFINITIONS: Record<string, CycleDefinition> = {
  DAILY: DAILY_CYCLE,
  WEEKLY: WEEKLY_CYCLE,
  MONTHLY: MONTHLY_CYCLE,
  MANUAL: MONTHLY_CYCLE,
};

export const DEFAULT_SCHEDULES = {
  daily: DAILY_CYCLE.defaultCron,
  weekly: WEEKLY_CYCLE.defaultCron,
  monthly: MONTHLY_CYCLE.defaultCron,
};
