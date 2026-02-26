'use client';

import { useState, useCallback } from 'react';
import {
  usePurchasingPanel,
  useExportPurchasing,
  useEmailSummary,
} from '@/hooks/use-purchasing';
import { ExecutionSelector } from './execution-selector';
import { PurchaseKpiCards } from './purchase-kpi-cards';
import { UrgentActionsTable } from './urgent-actions-table';
import { SupplierSummaryTable } from './supplier-summary-table';
import { Button } from '@/components/ui/button';

/**
 * Main Purchasing Panel wrapper.
 *
 * Composes all purchasing panel sections:
 * - Execution selector dropdown
 * - KPI cards (totals overview)
 * - Urgent actions table
 * - Supplier summary table
 * - Action buttons (export Excel, send email)
 *
 * @see Story 3.11 — Purchasing Panel (AC-8 through AC-15)
 */
export function PurchasingPanel() {
  const [selectedExecucaoId, setSelectedExecucaoId] = useState<string | null>(
    null,
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedExecucaoId(id);
  }, []);

  const {
    data: panelData,
    isLoading,
    isError,
    error,
  } = usePurchasingPanel(selectedExecucaoId);

  const exportMutation = useExportPurchasing();
  const emailMutation = useEmailSummary();

  const handleExport = () => {
    if (selectedExecucaoId === null) return;
    exportMutation.mutate(selectedExecucaoId);
  };

  const handleEmailSummary = () => {
    if (selectedExecucaoId === null) return;
    emailMutation.mutate(selectedExecucaoId);
  };

  return (
    <div className="space-y-6">
      {/* Execution Selector (AC-14) */}
      <ExecutionSelector
        selectedId={selectedExecucaoId}
        onSelect={handleSelect}
      />

      {/* Loading State */}
      {isLoading && selectedExecucaoId !== null && (
        <p className="text-sm text-gray-500">Carregando dados do painel...</p>
      )}

      {/* Error State */}
      {isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            Erro ao carregar dados:{' '}
            {error instanceof Error ? error.message : 'Erro desconhecido'}
          </p>
        </div>
      )}

      {/* No Execution Selected */}
      {selectedExecucaoId === null && !isLoading && (
        <p className="text-sm text-gray-500">
          Selecione uma execu\u00e7\u00e3o MRP para visualizar o painel de compras.
        </p>
      )}

      {/* Panel Data */}
      {panelData != null && (
        <>
          {/* KPI Cards (AC-11) */}
          <PurchaseKpiCards totals={panelData.totals} />

          {/* Urgent Actions Table (AC-9) */}
          <UrgentActionsTable actions={panelData.urgentActions} />

          {/* Supplier Summary Table (AC-10) */}
          <SupplierSummaryTable suppliers={panelData.supplierSummary} />

          {/* Action Buttons (AC-12, AC-13) */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleExport}
              disabled={exportMutation.isPending}
              variant="outline"
            >
              {exportMutation.isPending
                ? 'Exportando...'
                : 'Exportar Excel'}
            </Button>

            <Button
              onClick={handleEmailSummary}
              disabled={emailMutation.isPending}
              variant="outline"
            >
              {emailMutation.isPending
                ? 'Enviando...'
                : 'Enviar Resumo por Email'}
            </Button>

            {/* Export success indicator */}
            {exportMutation.isSuccess && (
              <span className="text-sm text-green-600">
                Download iniciado!
              </span>
            )}

            {/* Email success toast */}
            {emailMutation.isSuccess && (
              <span className="text-sm text-green-600">
                Resumo enviado com sucesso!
              </span>
            )}

            {/* Email error indicator */}
            {emailMutation.isError && (
              <span className="text-sm text-red-600">
                Erro ao enviar email.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
