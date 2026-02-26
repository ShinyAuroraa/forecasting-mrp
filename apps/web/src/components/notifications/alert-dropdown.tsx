'use client';

import { useAlerts, useAcknowledgeAlert } from '@/hooks/use-notifications';
import {
  ALERT_TYPE_LABELS,
  SEVERITY_COLORS,
} from '@/types/notifications';
import type { Alert } from '@/types/notifications';

interface AlertDropdownProps {
  readonly onClose: () => void;
}

/**
 * Alert Dropdown Panel
 *
 * Shows recent unacknowledged alerts in a dropdown.
 * Each alert can be acknowledged inline.
 *
 * @see Story 4.4 — AC-18
 */
export function AlertDropdown({ onClose }: AlertDropdownProps) {
  const { data, isLoading, isError } = useAlerts({
    acknowledged: false,
    limit: 10,
  });
  const acknowledgeMutation = useAcknowledgeAlert();

  const handleAcknowledge = (id: string) => {
    acknowledgeMutation.mutate(id);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        role="presentation"
      />
      <div
        className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-[70vh] overflow-hidden flex flex-col"
        data-testid="alert-dropdown"
        role="dialog"
        aria-label="Alertas recentes"
      >
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Alertas</h3>
          <a
            href="/alertas"
            className="text-sm text-blue-600 hover:underline"
          >
            Ver todos
          </a>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="p-4 text-center text-gray-500 text-sm">
              Carregando...
            </div>
          )}

          {isError && (
            <div className="p-4 text-center text-red-500 text-sm" data-testid="alert-error">
              Erro ao carregar alertas. Tente novamente.
            </div>
          )}

          {!isLoading && !isError && (!data?.data || data.data.length === 0) && (
            <div className="p-8 text-center text-gray-400 text-sm" data-testid="no-alerts">
              Nenhum alerta pendente
            </div>
          )}

          {data?.data.map((alert: Alert) => (
            <div
              key={alert.id}
              className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors"
              data-testid="alert-item"
            >
              <div className="flex items-start gap-2">
                <span
                  className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${SEVERITY_COLORS[alert.severidade]}`}
                >
                  {alert.severidade}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {alert.titulo}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {ALERT_TYPE_LABELS[alert.tipo]}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatRelativeTime(alert.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAcknowledge(alert.id)}
                  disabled={acknowledgeMutation.isPending}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                  data-testid="ack-button"
                >
                  Reconhecer
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Agora';
  if (diffMin < 60) return `${diffMin}min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}
