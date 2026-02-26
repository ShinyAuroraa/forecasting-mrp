/**
 * Daily Pipeline Step Definitions
 *
 * Steps execute sequentially respecting dependency order.
 * Steps with `required: false` allow graceful degradation (AC-13, AC-14, AC-15).
 *
 * @see Story 4.6 — FR-052
 */

import type { PipelineStepDef } from './pipeline.types';

export const PIPELINE_STEPS: readonly PipelineStepDef[] = [
  {
    id: 'fetch-data',
    name: 'Buscar dados (Email/ERP)',
    order: 1,
    dependsOn: [],
    required: false, // AC-13: if fetch fails, skip ingestion, run forecast+MRP with existing data
    timeoutMs: 120_000,
  },
  {
    id: 'etl',
    name: 'Aplicar template e executar ETL incremental',
    order: 2,
    dependsOn: ['fetch-data'],
    required: false,
    timeoutMs: 180_000,
  },
  {
    id: 'update-stock',
    name: 'Atualizar inventario',
    order: 3,
    dependsOn: ['etl'],
    required: false,
    timeoutMs: 60_000,
  },
  {
    id: 'forecast',
    name: 'Executar inferencia de forecast',
    order: 4,
    dependsOn: [],  // Can run with existing data if ingestion failed (AC-13)
    required: false, // AC-14: if forecast fails, run MRP with last known forecast
    timeoutMs: 300_000,
  },
  {
    id: 'mrp',
    name: 'Recalcular MRP incremental',
    order: 5,
    dependsOn: [],  // Can run with last known forecast (AC-14)
    required: false, // AC-15: if MRP fails, still generate alerts from last known results
    timeoutMs: 600_000,
  },
  {
    id: 'alerts',
    name: 'Verificar alertas',
    order: 6,
    dependsOn: [],  // Always runs with whatever data is available (AC-15)
    required: false,
    timeoutMs: 60_000,
  },
  {
    id: 'email',
    name: 'Enviar resumo diario',
    order: 7,
    dependsOn: ['alerts'],
    required: false,
    timeoutMs: 30_000,
  },
] as const;

/**
 * Determine which steps should be skipped based on failed steps and dependencies.
 * A step is skipped if ANY of its dependencies have failed or were skipped.
 */
export function shouldSkipStep(
  stepId: string,
  failedSteps: ReadonlySet<string>,
  skippedSteps: ReadonlySet<string>,
): boolean {
  const step = PIPELINE_STEPS.find((s) => s.id === stepId);
  if (!step) return true;

  return step.dependsOn.some(
    (dep) => failedSteps.has(dep) || skippedSteps.has(dep),
  );
}
