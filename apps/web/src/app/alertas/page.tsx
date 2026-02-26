'use client';

import { useState } from 'react';
import { useAlerts, useAcknowledgeAlert } from '@/hooks/use-notifications';
import {
  ALERT_TYPE_LABELS,
  ALERT_SEVERITY_LABELS,
  SEVERITY_COLORS,
} from '@/types/notifications';
import type { AlertType, AlertSeverity, Alert } from '@/types/notifications';

const ALERT_TYPES: AlertType[] = [
  'STOCKOUT', 'URGENT_PURCHASE', 'CAPACITY_OVERLOAD',
  'FORECAST_DEVIATION', 'STORAGE_FULL', 'PIPELINE_FAILURE',
];
const ALERT_SEVERITIES: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const PAGE_SIZE = 20;

/**
 * Full Alert History Page
 *
 * Lists all alerts with filters (type, severity, acknowledged, date range)
 * and pagination.
 *
 * @see Story 4.4 — AC-19
 */
export default function AlertasPage() {
  const [tipo, setTipo] = useState<AlertType | ''>('');
  const [severidade, setSeveridade] = useState<AlertSeverity | ''>('');
  const [acknowledged, setAcknowledged] = useState<'' | 'true' | 'false'>('');
  const [offset, setOffset] = useState(0);

  const queryParams = {
    ...(tipo && { tipo }),
    ...(severidade && { severidade }),
    ...(acknowledged && { acknowledged: acknowledged === 'true' }),
    limit: PAGE_SIZE,
    offset,
  };

  const { data, isLoading, isError } = useAlerts(queryParams);
  const acknowledgeMutation = useAcknowledgeAlert();

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const handlePageChange = (page: number) => {
    setOffset((page - 1) * PAGE_SIZE);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Histórico de Alertas
      </h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6" data-testid="alert-filters">
        <select
          value={tipo}
          onChange={(e) => { setTipo(e.target.value as AlertType | ''); setOffset(0); }}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos os tipos</option>
          {ALERT_TYPES.map((t) => (
            <option key={t} value={t}>{ALERT_TYPE_LABELS[t]}</option>
          ))}
        </select>

        <select
          value={severidade}
          onChange={(e) => { setSeveridade(e.target.value as AlertSeverity | ''); setOffset(0); }}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          aria-label="Filtrar por severidade"
        >
          <option value="">Todas as severidades</option>
          {ALERT_SEVERITIES.map((s) => (
            <option key={s} value={s}>{ALERT_SEVERITY_LABELS[s]}</option>
          ))}
        </select>

        <select
          value={acknowledged}
          onChange={(e) => { setAcknowledged(e.target.value as '' | 'true' | 'false'); setOffset(0); }}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          aria-label="Filtrar por status"
        >
          <option value="">Todos</option>
          <option value="false">Pendentes</option>
          <option value="true">Reconhecidos</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm" data-testid="alerts-table">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Severidade</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Título</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Data</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Carregando...
                </td>
              </tr>
            )}

            {isError && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-red-500" data-testid="alert-error">
                  Erro ao carregar alertas. Tente novamente.
                </td>
              </tr>
            )}

            {!isLoading && !isError && (!data?.data || data.data.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400" data-testid="no-alerts">
                  Nenhum alerta encontrado
                </td>
              </tr>
            )}

            {data?.data.map((alert: Alert) => (
              <tr key={alert.id} className="hover:bg-gray-50" data-testid="alert-row">
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded ${SEVERITY_COLORS[alert.severidade]}`}>
                    {alert.severidade}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {ALERT_TYPE_LABELS[alert.tipo]}
                </td>
                <td className="px-4 py-3 text-gray-900 font-medium max-w-xs truncate">
                  {alert.titulo}
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {new Date(alert.createdAt).toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-3">
                  {alert.acknowledgedAt ? (
                    <span className="text-green-600 text-xs font-medium">Reconhecido</span>
                  ) : (
                    <span className="text-orange-500 text-xs font-medium">Pendente</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!alert.acknowledgedAt && (
                    <button
                      type="button"
                      onClick={() => acknowledgeMutation.mutate(alert.id)}
                      disabled={acknowledgeMutation.isPending}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      data-testid="ack-button"
                    >
                      Reconhecer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4" data-testid="pagination">
          <p className="text-sm text-gray-500">
            Mostrando {offset + 1}–{Math.min(offset + PAGE_SIZE, data?.total ?? 0)} de {data?.total ?? 0}
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Próximo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
