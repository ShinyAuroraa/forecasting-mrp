'use client';

import { useLotSizingCompare, type LotSizingMethodResult } from '@/hooks/use-lot-sizing-compare';

const METHOD_LABELS: Record<string, string> = {
  L4L: 'Lot-for-Lot',
  EOQ: 'Lote Econômico (EOQ)',
  SILVER_MEAL: 'Silver-Meal',
  WAGNER_WHITIN: 'Wagner-Whitin (Ótimo)',
};

interface LotSizingComparisonProps {
  readonly produtoId: string | null;
}

/**
 * Cost comparison card for all 4 lot sizing methods.
 *
 * Displays ordering cost, holding cost, total cost, number of orders,
 * and average order qty for each method. Highlights the recommended
 * (lowest total cost) method.
 *
 * @see Story 5.1 — AC-15
 */
export function LotSizingComparison({ produtoId }: LotSizingComparisonProps) {
  const { data, isLoading, error } = useLotSizingCompare(produtoId);

  if (!produtoId) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
        Selecione um produto para comparar métodos de lotificação.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
        Calculando comparação de custos...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-destructive">
        Erro ao carregar comparação. Execute o MRP primeiro.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">
        Comparação de Lotificação
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4">Método</th>
              <th className="pb-2 pr-4 text-right">Custo Pedido</th>
              <th className="pb-2 pr-4 text-right">Custo Estoque</th>
              <th className="pb-2 pr-4 text-right">Custo Total</th>
              <th className="pb-2 pr-4 text-right">Nº Pedidos</th>
              <th className="pb-2 text-right">Qtd Média</th>
            </tr>
          </thead>
          <tbody>
            {data.methods.map((m: LotSizingMethodResult) => {
              const isRecommended = m.method === data.recommendation;
              return (
                <tr
                  key={m.method}
                  className={`border-b last:border-0 ${isRecommended ? 'bg-primary/5 font-medium' : ''}`}
                >
                  <td className="py-2 pr-4">
                    {METHOD_LABELS[m.method] ?? m.method}
                    {isRecommended && (
                      <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                        Recomendado
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {m.orderingCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {m.holdingCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums font-semibold">
                    {m.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{m.numberOfOrders}</td>
                  <td className="py-2 text-right tabular-nums">
                    {m.avgOrderQty.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
