'use client';

import { useState } from 'react';
import { ExecutionSelector } from '@/components/purchasing/execution-selector';
import { GanttChart } from './components/gantt-chart';
import { useMrpOrders } from '@/hooks/use-mrp';

/**
 * MRP Gantt page — /mrp
 *
 * Displays a Gantt timeline of all planned orders for a selected MRP execution.
 *
 * @see Story 3.12 — MRP Gantt (AC-1 to AC-4, AC-17)
 */
export default function MrpGanttPage() {
  const [execucaoId, setExecucaoId] = useState<string | null>(null);

  const { data: ordersData, isLoading, isError } = useMrpOrders(execucaoId);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">MRP — Gantt de Ordens</h1>

      <ExecutionSelector selectedId={execucaoId} onSelect={setExecucaoId} />

      {isLoading && (
        <p className="text-sm text-gray-500">Carregando ordens planejadas...</p>
      )}

      {isError && (
        <p className="text-sm text-red-500">Erro ao carregar ordens. Tente novamente.</p>
      )}

      {ordersData && (
        <GanttChart orders={ordersData.data} />
      )}

      {!isLoading && !isError && !ordersData && execucaoId && (
        <p className="text-sm text-gray-500">
          Nenhuma ordem planejada encontrada para esta execução.
        </p>
      )}
    </main>
  );
}
