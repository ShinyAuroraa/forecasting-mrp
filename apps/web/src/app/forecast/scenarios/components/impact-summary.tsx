'use client';

import type { ScenarioImpact } from '@/types/scenario';

interface ImpactSummaryProps {
  readonly impact: ScenarioImpact;
}

function DeltaCard({
  label,
  baseline,
  scenario,
  delta,
  unit,
}: {
  readonly label: string;
  readonly baseline: number;
  readonly scenario: number;
  readonly delta: number;
  readonly unit: string;
}) {
  const isPositive = delta > 0;
  const color = isPositive ? 'text-amber-600' : delta < 0 ? 'text-green-600' : 'text-gray-400';

  const formatValue = (v: number) => {
    if (unit === 'BRL') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    if (unit === '%') return `${v.toFixed(1)}%`;
    return String(v);
  };

  return (
    <div className="rounded-lg border bg-gray-50 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{formatValue(scenario)}</p>
      <p className={`mt-1 text-xs ${color}`}>
        {isPositive ? '+' : ''}{formatValue(delta)} vs baseline ({formatValue(baseline)})
      </p>
    </div>
  );
}

/**
 * Impact summary cards — showing delta between baseline and scenario.
 *
 * @see Story 4.9 — AC-7, AC-8, AC-9, AC-16
 */
export function ImpactSummary({ impact }: ImpactSummaryProps) {
  return (
    <div data-testid="impact-summary" className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold">Impacto do Cenário</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DeltaCard
          label="Ordens Planejadas"
          baseline={impact.baseline.totalPlannedOrders}
          scenario={impact.scenario.totalPlannedOrders}
          delta={impact.delta.plannedOrdersDelta}
          unit=""
        />
        <DeltaCard
          label="Valor Total de Ordens"
          baseline={impact.baseline.totalOrderValue}
          scenario={impact.scenario.totalOrderValue}
          delta={impact.delta.orderValueDelta}
          unit="BRL"
        />
        <DeltaCard
          label="Utilização Capacidade"
          baseline={impact.baseline.avgCapacityUtilization}
          scenario={impact.scenario.avgCapacityUtilization}
          delta={impact.delta.capacityDelta}
          unit="%"
        />
        <DeltaCard
          label="Investimento em Estoque"
          baseline={impact.baseline.totalInventoryValue}
          scenario={impact.scenario.totalInventoryValue}
          delta={impact.delta.inventoryDelta}
          unit="BRL"
        />
      </div>
    </div>
  );
}
