'use client';

import { useState } from 'react';
import {
  useCycleSchedule,
  useCycleExecutions,
  useTriggerCycle,
} from '@/hooks/use-cycles';
import {
  CYCLE_TYPE_LABELS,
  CYCLE_STATUS_LABELS,
  CYCLE_STATUS_COLORS,
} from '@/types/cycles';
import type { CycleType, CycleScheduleInfo, CycleExecution } from '@/types/cycles';

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function ScheduleCard({
  info,
  onTrigger,
  isPending,
}: {
  readonly info: CycleScheduleInfo;
  readonly onTrigger: (type: CycleType) => void;
  readonly isPending: boolean;
}) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleTrigger = () => {
    onTrigger(info.type);
    setShowConfirm(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4" data-testid={`schedule-card-${info.type}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{info.label}</h3>
        {!showConfirm ? (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={isPending}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            data-testid={`trigger-btn-${info.type}`}
          >
            Executar Agora
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleTrigger}
              disabled={isPending}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              data-testid={`confirm-trigger-${info.type}`}
            >
              {isPending ? 'Executando...' : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-gray-500">Cron:</span>{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">{info.cronExpression}</code>
        </div>
        <div>
          <span className="text-gray-500">Proxima execucao:</span>{' '}
          <span className="text-gray-700">{formatDateTime(info.nextRunAt)}</span>
        </div>
      </div>

      {info.lastExecution && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-sm" data-testid={`last-exec-${info.type}`}>
          <span className="text-gray-500">Ultima execucao:</span>{' '}
          <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded ${CYCLE_STATUS_COLORS[info.lastExecution.status]}`}>
            {CYCLE_STATUS_LABELS[info.lastExecution.status]}
          </span>{' '}
          <span className="text-gray-600">
            {formatDateTime(info.lastExecution.startedAt)}
            {info.lastExecution.durationMs !== null && (
              <> ({formatDuration(info.lastExecution.durationMs)})</>
            )}
          </span>
        </div>
      )}

      {!info.lastExecution && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-400">
          Nenhuma execucao registrada
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 20;

/**
 * Schedule Management Page
 *
 * Displays cycle schedules, next run times, last execution status,
 * manual trigger buttons, and execution history.
 *
 * @see Story 4.5 — AC-14, AC-15, AC-16
 */
export default function SchedulePage() {
  const [page, setPage] = useState(1);
  const { data: schedules, isLoading: schedulesLoading, isError: schedulesError } = useCycleSchedule();
  const { data: executions, isLoading: executionsLoading, isError: executionsError } = useCycleExecutions({
    page,
    limit: PAGE_SIZE,
  });
  const triggerMutation = useTriggerCycle();

  const handleTrigger = (type: CycleType) => {
    triggerMutation.mutate(type);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Gerenciamento de Ciclos
      </h1>

      {/* Trigger result feedback */}
      {triggerMutation.isSuccess && (
        <div className="mb-4 p-3 rounded bg-green-50 text-green-700 border border-green-200 text-sm" data-testid="trigger-success">
          Ciclo {CYCLE_TYPE_LABELS[triggerMutation.data.type]} iniciado com sucesso (ID: {triggerMutation.data.id.slice(0, 8)}...)
        </div>
      )}
      {triggerMutation.isError && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm" data-testid="trigger-error">
          Erro ao iniciar ciclo: {(triggerMutation.error as Error).message}
        </div>
      )}

      {/* Schedule Cards (AC-14, AC-15) */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Agendamentos</h2>

        {schedulesLoading && <p className="text-gray-500">Carregando agendamentos...</p>}
        {schedulesError && (
          <p className="text-red-500" data-testid="schedule-error">
            Erro ao carregar agendamentos. Tente novamente.
          </p>
        )}

        {schedules && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="schedule-cards">
            {schedules.map((info: CycleScheduleInfo) => (
              <ScheduleCard
                key={info.type}
                info={info}
                onTrigger={handleTrigger}
                isPending={triggerMutation.isPending}
              />
            ))}
          </div>
        )}
      </section>

      {/* Execution Log Table (AC-16) */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Historico de Execucoes</h2>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm" data-testid="executions-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Inicio</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Duracao</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Passos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {executionsLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Carregando...
                  </td>
                </tr>
              )}

              {executionsError && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-red-500" data-testid="executions-error">
                    Erro ao carregar execucoes. Tente novamente.
                  </td>
                </tr>
              )}

              {!executionsLoading && !executionsError && (!executions?.data || executions.data.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400" data-testid="no-executions">
                    Nenhuma execucao encontrada
                  </td>
                </tr>
              )}

              {executions?.data.map((exec: CycleExecution) => {
                const durationMs = exec.startedAt && exec.completedAt
                  ? new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime()
                  : null;

                return (
                  <tr key={exec.id} className="hover:bg-gray-50" data-testid="execution-row">
                    <td className="px-4 py-3 text-gray-700 font-medium">
                      {CYCLE_TYPE_LABELS[exec.type]}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded ${CYCLE_STATUS_COLORS[exec.status]}`}>
                        {CYCLE_STATUS_LABELS[exec.status]}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {executions && executions.meta.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4" data-testid="pagination">
            <p className="text-sm text-gray-500">
              Pagina {executions.meta.page} de {executions.meta.totalPages} ({executions.meta.total} total)
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!executions.meta.hasPrev}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={!executions.meta.hasNext}
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
