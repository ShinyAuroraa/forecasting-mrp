'use client';

import { useState } from 'react';
import { ExecutionSelector } from '@/components/purchasing/execution-selector';
import { SkuSelector } from '@/components/mrp/sku-selector';
import { StockProjectionChart } from './components/stock-projection-chart';
import { useMrpOrders, useMrpStockParams } from '@/hooks/use-mrp';

/**
 * Stock Projection page — /mrp/stock
 *
 * Per-SKU stock projection line chart with SS/ROP/Max reference lines.
 *
 * @see Story 3.12 — Stock Projection (AC-8 to AC-11, AC-17)
 */
export default function StockProjectionPage() {
  const [execucaoId, setExecucaoId] = useState<string | null>(null);
  const [produtoId, setProdutoId] = useState<string | null>(null);

  const { data: ordersData, isLoading: loadingOrders, isError: ordersError } =
    useMrpOrders(execucaoId);

  const { data: stockParamsData } = useMrpStockParams(
    execucaoId,
    produtoId ?? undefined,
  );

  const selectedStockParams = stockParamsData?.data[0] ?? null;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">MRP — Projeção de Estoque</h1>

      <div className="flex flex-wrap items-center gap-6">
        <ExecutionSelector selectedId={execucaoId} onSelect={setExecucaoId} />
        {ordersData && (
          <SkuSelector
            orders={ordersData.data}
            selectedProdutoId={produtoId}
            onSelect={setProdutoId}
          />
        )}
      </div>

      {loadingOrders && (
        <p className="text-sm text-gray-500">Carregando dados...</p>
      )}

      {ordersError && (
        <p className="text-sm text-red-500">Erro ao carregar dados. Tente novamente.</p>
      )}

      {ordersData && produtoId && (
        <StockProjectionChart
          orders={ordersData.data}
          stockParams={selectedStockParams}
          produtoId={produtoId}
        />
      )}

      {!produtoId && ordersData && (
        <p className="text-sm text-gray-500">
          Selecione um SKU para visualizar a projeção de estoque.
        </p>
      )}
    </main>
  );
}
