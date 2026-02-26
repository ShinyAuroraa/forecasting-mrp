'use client';

import { useState } from 'react';
import { ExecutionSelector } from '@/components/purchasing/execution-selector';
import { CapacityBarChart } from './components/capacity-bar-chart';
import { UtilizationHeatmap } from './components/utilization-heatmap';
import { WarehouseGauge } from './components/warehouse-gauge';
import { OverloadAlerts } from './components/overload-alerts';
import { useMrpCapacity, useMrpStorage } from '@/hooks/use-mrp';

/**
 * Capacity Dashboard page — /mrp/capacity
 *
 * Displays 4 visualization sections:
 * 1. Stacked bar chart — planned load vs available capacity
 * 2. Heatmap — weekly utilization % per work center
 * 3. Warehouse gauges — storage utilization per deposito
 * 4. Overload alerts — work centers > 100% with suggestions
 *
 * @see Story 3.12 — Capacity Dashboard (AC-12 to AC-16, AC-17)
 */
export default function CapacityDashboardPage() {
  const [execucaoId, setExecucaoId] = useState<string | null>(null);

  const { data: capacityData, isLoading, isError } = useMrpCapacity(execucaoId);
  const { data: storageDepositos } = useMrpStorage(execucaoId);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">MRP — Dashboard de Capacidade</h1>

      <ExecutionSelector selectedId={execucaoId} onSelect={setExecucaoId} />

      {isLoading && (
        <p className="text-sm text-gray-500">Carregando dados de capacidade...</p>
      )}

      {isError && (
        <p className="text-sm text-red-500">Erro ao carregar dados de capacidade. Tente novamente.</p>
      )}

      {capacityData && (
        <>
          <CapacityBarChart records={capacityData.data} />

          <UtilizationHeatmap records={capacityData.data} />

          {storageDepositos && storageDepositos.length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-semibold">
                Utilização de Armazéns
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {storageDepositos.map((deposito) => (
                  <WarehouseGauge key={deposito.depositoId} deposito={deposito} />
                ))}
              </div>
            </div>
          )}

          <OverloadAlerts records={capacityData.data} />
        </>
      )}
    </main>
  );
}
