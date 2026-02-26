'use client';

import { useEffect } from 'react';
import { useMrpExecutions } from '@/hooks/use-purchasing';
import type { MrpExecution } from '@/types/purchasing';

interface ExecutionSelectorProps {
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}

/**
 * Dropdown selector for MRP executions.
 *
 * Lists recent executions sorted by date (desc).
 * Auto-selects the latest CONCLUIDO execution on mount.
 *
 * @see Story 3.11 — Purchasing Panel (AC-14)
 */
export function ExecutionSelector({
  selectedId,
  onSelect,
}: ExecutionSelectorProps) {
  const { data: executions, isLoading } = useMrpExecutions();

  // Auto-select the most recent completed execution
  useEffect(() => {
    if (selectedId !== null) {
      return;
    }
    const completedExecution = executions?.data.find(
      (exec: MrpExecution) => exec.status === 'CONCLUIDO',
    );
    if (completedExecution !== undefined) {
      onSelect(completedExecution.id);
    }
  }, [executions, selectedId, onSelect]);

  const formatExecutionLabel = (exec: MrpExecution): string => {
    const date = new Date(exec.createdAt).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const statusMap: Record<string, string> = {
      CONCLUIDO: 'Concluído',
      EXECUTANDO: 'Executando',
      PENDENTE: 'Pendente',
      ERRO: 'Erro',
    };
    const statusLabel = statusMap[exec.status] ?? exec.status;
    return `${date} — ${statusLabel}`;
  };

  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor="execution-selector"
        className="text-sm font-medium text-gray-700"
      >
        Execução MRP:
      </label>
      <select
        id="execution-selector"
        value={selectedId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        disabled={isLoading}
        className="h-10 min-w-[300px] rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {isLoading ? (
          <option value="">Carregando execuções...</option>
        ) : !executions?.data.length ? (
          <option value="">Nenhuma execução encontrada</option>
        ) : (
          <>
            <option value="">Selecione uma execução</option>
            {executions.data.map((exec: MrpExecution) => (
              <option key={exec.id} value={exec.id}>
                {formatExecutionLabel(exec)}
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}
