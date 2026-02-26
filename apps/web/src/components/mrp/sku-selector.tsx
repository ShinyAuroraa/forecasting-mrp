'use client';

import { useMemo } from 'react';
import type { PlannedOrder } from '@/types/mrp';

interface SkuSelectorProps {
  readonly orders: readonly PlannedOrder[];
  readonly selectedProdutoId: string | null;
  readonly onSelect: (produtoId: string) => void;
}

/**
 * SKU selector dropdown for MRP Detail and Stock Projection pages.
 *
 * Builds a unique SKU list from the planned orders of the selected execution.
 *
 * @see Story 3.12 — MRP Detail (AC-5), Stock Projection (AC-8)
 */
export function SkuSelector({
  orders,
  selectedProdutoId,
  onSelect,
}: SkuSelectorProps) {
  const skuList = useMemo(() => {
    const seen = new Map<string, string>();
    for (const order of orders) {
      if (!seen.has(order.produtoId)) {
        const label = order.produto
          ? `${order.produto.codigo} — ${order.produto.descricao}`
          : order.produtoId;
        seen.set(order.produtoId, label);
      }
    }
    return Array.from(seen.entries()).sort((a, b) =>
      a[1].localeCompare(b[1]),
    );
  }, [orders]);

  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor="sku-selector"
        className="text-sm font-medium text-gray-700"
      >
        SKU:
      </label>
      <select
        id="sku-selector"
        value={selectedProdutoId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        className="h-10 min-w-[340px] rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {skuList.length === 0 ? (
          <option value="">Nenhum SKU encontrado</option>
        ) : (
          <>
            <option value="">Selecione um SKU</option>
            {skuList.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}
