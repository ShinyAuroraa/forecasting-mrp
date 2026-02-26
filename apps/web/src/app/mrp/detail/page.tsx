'use client';

import { useState } from 'react';
import { ExecutionSelector } from '@/components/purchasing/execution-selector';
import { SkuSelector } from '@/components/mrp/sku-selector';
import { LotSizingComparison } from '@/components/mrp/lot-sizing-comparison';
import { MonteCarloSimulation } from '@/components/mrp/monte-carlo-badge';
import { MrpGridTable } from './components/mrp-grid-table';
import { useMrpOrders, useMrpStockParams } from '@/hooks/use-mrp';

/**
 * MRP Detail page — /mrp/detail
 *
 * Displays the MRP grid table for a selected SKU within a selected execution.
 *
 * @see Story 3.12 — MRP Detail (AC-5 to AC-7, AC-17)
 */
export default function MrpDetailPage() {
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
      <h1 className="text-2xl font-bold">MRP — Detalhamento por SKU</h1>

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
        <p className="text-sm text-gray-500">Carregando ordens...</p>
      )}

      {ordersError && (
        <p className="text-sm text-red-500">Erro ao carregar ordens. Tente novamente.</p>
      )}

      {ordersData && produtoId && (
        <>
          <MrpGridTable
            orders={ordersData.data}
            stockParams={selectedStockParams}
            produtoId={produtoId}
          />
          <LotSizingComparison produtoId={produtoId} />
          <MonteCarloSimulation
            produtoId={produtoId}
            metodoCalculo={selectedStockParams?.metodoCalculo}
          />
        </>
      )}

      {!produtoId && ordersData && (
        <p className="text-sm text-gray-500">
          Selecione um SKU para visualizar a grade MRP.
        </p>
      )}
    </main>
  );
}
