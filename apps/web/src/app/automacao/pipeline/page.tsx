'use client';

import { useState, useMemo } from 'react';
import {
  usePipelineStatus,
  usePipelineHistory,
  useTriggerPipeline,
  usePipelineDetail,
  useSSEProgress,
} from '@/hooks/use-pipeline';
import {
  PIPELINE_STATUS_LABELS,
  PIPELINE_STATUS_COLORS,
  PIPELINE_STEP_LABELS,
  STEP_STATUS_COLORS,
} from '@/types/pipeline';
import type {
  PipelineExecution,
  PipelineStepId,
  PipelineStepStatus,
  PipelineProgressEvent,
} from '@/types/pipeline';

function formatDateTime(iso: string | null): string {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '\u2014';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function StepStatusBadge({ status }: { readonly status: PipelineStepStatus }) {
  const labels: Record<PipelineStepStatus, string> = {
    PENDING: 'Pendente',
    RUNNING: 'Executando',
    COMPLETED: 'Concluido',
    FAILED: 'Falha',
    SKIPPED: 'Ignorado',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded ${STEP_STATUS_COLORS[status]}`}>
      {labels[status]}
    </span>
  );
}

function PipelineStatusCard({
  execution,
  onTrigger,
  isPending,
}: {
  readonly execution: PipelineExecution | null;
  readonly onTrigger: () => void;
  readonly isPending: boolean;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const isRunning = execution?.status === 'RUNNING' || execution?.status === 'PENDING';

  const handleTrigger = () => {
    onTrigger();
    setShowConfirm(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6" data-testid="pipeline-status-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Pipeline Diario</h2>
        {!showConfirm ? (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={isPending || isRunning}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            data-testid="trigger-pipeline-btn"
          >
            {isRunning ? 'Pipeline em Execucao...' : 'Executar Pipeline'}
          </button>
        ) : (
          <div className="flex gap-2" data-testid="trigger-confirm">
            <button
              type="button"
              onClick={handleTrigger}
              disabled={isPending}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              data-testid="confirm-trigger-btn"
            >
              {isPending ? 'Iniciando...' : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {execution ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Status:</span>{' '}
            <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded ${PIPELINE_STATUS_COLORS[execution.status]}`}>
              {PIPELINE_STATUS_LABELS[execution.status]}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Inicio:</span>{' '}
            <span className="text-gray-700">{formatDateTime(execution.startedAt)}</span>
          </div>
          <div>
            <span className="text-gray-500">Progresso:</span>{' '}
            <span className="text-gray-700">{execution.stepsCompleted}/{execution.stepsTotal}</span>
          </div>
          <div>
            <span className="text-gray-500">Fim:</span>{' '}
            <span className="text-gray-700">{formatDateTime(execution.completedAt)}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400" data-testid="no-pipeline-status">
          Nenhuma execucao recente
        </p>
      )}
    </div>
  );
}

function StepProgressList({ executionId }: { readonly executionId: string | null }) {
  const { data: detail } = usePipelineDetail(executionId);
  const { stepEvents } = useSSEProgress(executionId);

  // Merge detail steps with real-time SSE events (AC-19)
  const steps = useMemo(() => {
    const baseSteps = [...(detail?.steps ?? [])];
    if (stepEvents.length === 0) return baseSteps;

    const sseMap = new Map(stepEvents.map((e) => [e.stepId, e]));

    const merged = baseSteps.map((step) => {
      const sseEvent = sseMap.get(step.stepId);
      return sseEvent
        ? { ...step, status: sseEvent.status as PipelineStepStatus }
        : step;
    });

    // Add SSE-only steps not yet in detail (pipeline in progress, detail not refreshed)
    for (const [stepId, event] of sseMap) {
      if (!baseSteps.some((s) => s.stepId === stepId)) {
        merged.push({
          stepId: stepId as PipelineStepId,
          status: event.status as PipelineStepStatus,
          durationMs: null,
          details: null,
          errorMessage: null,
        });
      }
    }

    return merged;
  }, [detail?.steps, stepEvents]);

  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mt-4" data-testid="step-progress">
      <h3 className="text-md font-semibold text-gray-800 mb-3">Progresso dos Passos</h3>
      <div className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.stepId}
            className="flex items-center justify-between py-2 px-3 rounded bg-gray-50"
            data-testid={`step-row-${step.stepId}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">
                {PIPELINE_STEP_LABELS[step.stepId as PipelineStepId] ?? step.stepId}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {step.durationMs !== null && (
                <span className="text-xs text-gray-400">{formatDuration(step.durationMs)}</span>
              )}
              <StepStatusBadge status={step.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PAGE_SIZE = 20;

/**
 * Pipeline Monitoring Page
 *
 * Shows current pipeline status, real-time step progress,
 * manual trigger, and execution history.
 *
 * @see Story 4.6 — AC-18, AC-19
 */
export default function PipelinePage() {
  const [page, setPage] = useState(1);
  const { data: currentStatus, isLoading: statusLoading } = usePipelineStatus();
  const { data: history, isLoading: historyLoading } = usePipelineHistory(page, PAGE_SIZE);
  const triggerMutation = useTriggerPipeline();

  const handleTrigger = () => {
    triggerMutation.mutate();
  };

  const activeExecutionId = currentStatus?.status === 'RUNNING' || currentStatus?.status === 'PENDING'
    ? currentStatus.id
    : null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Pipeline Automatizado Diario
      </h1>

      {/* Trigger feedback */}
      {triggerMutation.isSuccess && (
        <div className="mb-4 p-3 rounded bg-green-50 text-green-700 border border-green-200 text-sm" data-testid="trigger-success">
          Pipeline iniciado com sucesso (ID: {triggerMutation.data.id.slice(0, 8)}...)
        </div>
      )}
      {triggerMutation.isError && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm" data-testid="trigger-error">
          Erro ao iniciar pipeline: {(triggerMutation.error as Error).message}
        </div>
      )}

      {/* Status Card (AC-21) */}
      {statusLoading && <p className="text-gray-500 mb-4" data-testid="status-loading">Carregando status...</p>}
      {!statusLoading && (
        <PipelineStatusCard
          execution={currentStatus ?? null}
          onTrigger={handleTrigger}
          isPending={triggerMutation.isPending}
        />
      )}

      {/* Step Progress (AC-19) */}
      {activeExecutionId && <StepProgressList executionId={activeExecutionId} />}

      {/* Execution History (AC-18) */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Historico de Execucoes</h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm" data-testid="history-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Inicio</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Duracao</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Passos</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Erro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {historyLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Carregando...
                  </td>
                </tr>
              )}

              {!historyLoading && (!history?.data || history.data.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400" data-testid="no-history">
                    Nenhuma execucao encontrada
                  </td>
                </tr>
              )}

              {history?.data.map((exec) => {
                const durationMs = exec.startedAt && exec.completedAt
                  ? new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime()
                  : null;

                return (
                  <tr key={exec.id} className="hover:bg-gray-50" data-testid="history-row">
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded ${PIPELINE_STATUS_COLORS[exec.status]}`}>
                        {PIPELINE_STATUS_LABELS[exec.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDateTime(exec.startedAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDuration(durationMs)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {exec.stepsCompleted}/{exec.stepsTotal}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                      {exec.errorMessage ?? '\u2014'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {history && history.meta.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4" data-testid="pagination">
            <p className="text-sm text-gray-500">
              Pagina {history.meta.page} de {history.meta.totalPages} ({history.meta.total} total)
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!history.meta.hasPrev}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={!history.meta.hasNext}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
              >
                Proximo
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
