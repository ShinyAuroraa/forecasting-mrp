'use client';

import { useRouter } from 'next/navigation';
import type { ActiveAlertsSummary } from '@/types/dashboard';

interface ActiveAlertsPanelProps {
  readonly data: ActiveAlertsSummary;
}

const ALERT_ROUTES: Record<string, string> = {
  STOCKOUT: '/alertas?tipo=STOCKOUT',
  URGENT_PURCHASE: '/compras?urgente=true',
  CAPACITY_OVERLOAD: '/capacidade?overload=true',
  STORAGE_FULL: '/estoque?armazemLotado=true',
  FORECAST_DEVIATION: '/alertas?tipo=FORECAST_DEVIATION',
  PIPELINE_FAILURE: '/automacao/pipeline',
};

const ALERT_ICONS: Record<string, string> = {
  STOCKOUT: '📦',
  URGENT_PURCHASE: '🛒',
  CAPACITY_OVERLOAD: '⚙️',
  STORAGE_FULL: '🏭',
  FORECAST_DEVIATION: '📊',
  PIPELINE_FAILURE: '🔧',
};

/**
 * Active Alerts Panel — summary of unacknowledged alerts by category.
 *
 * @see Story 4.8 — AC-14, AC-15
 */
export function ActiveAlertsPanel({ data }: ActiveAlertsPanelProps) {
  const router = useRouter();

  return (
    <div data-testid="active-alerts-panel" className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Alertas Ativos</h3>
        <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700">
          {data.total}
        </span>
      </div>

      <div className="space-y-2">
        {data.categories.map((cat) => (
          <button
            key={cat.type}
            data-testid={`alert-${cat.type.toLowerCase()}`}
            className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition hover:bg-gray-50"
            onClick={() => {
              const route = ALERT_ROUTES[cat.type];
              if (route) router.push(route);
            }}
          >
            <span className="flex items-center gap-2">
              <span>{ALERT_ICONS[cat.type] ?? '⚠️'}</span>
              <span className="text-sm">{cat.label}</span>
            </span>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-semibold">
              {cat.count}
            </span>
          </button>
        ))}
        {data.categories.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-400">Nenhum alerta ativo</p>
        )}
      </div>
    </div>
  );
}
