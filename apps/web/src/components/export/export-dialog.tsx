'use client';

import { useState } from 'react';
import { useRequestExport, useExportHistory, useDownloadExport } from '@/hooks/use-export';
import {
  EXPORT_TYPE_OPTIONS,
  PDF_SUPPORTED_TYPES,
  type ExportType,
  type ExportFormat,
} from '@/types/export';

interface ExportDialogProps {
  /** Pre-select an export type */
  readonly defaultType?: ExportType;
  /** Whether the dialog is open */
  readonly open: boolean;
  /** Called when dialog should close */
  readonly onClose: () => void;
}

/**
 * Shared export dialog with format selection and history.
 *
 * @see Story 4.10 — AC-18, AC-19, AC-20
 */
export function ExportDialog({ defaultType, open, onClose }: ExportDialogProps) {
  const [selectedType, setSelectedType] = useState<ExportType>(defaultType ?? 'MRP_ORDERS');
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [asyncMessage, setAsyncMessage] = useState<string | null>(null);

  const exportMutation = useRequestExport();
  const downloadMutation = useDownloadExport();
  const history = useExportHistory();

  const isPdfSupported = PDF_SUPPORTED_TYPES.includes(selectedType);

  const handleExport = async () => {
    setAsyncMessage(null);
    const result = await exportMutation.mutateAsync({
      request: { type: selectedType },
      format,
    });

    if (result.async) {
      setAsyncMessage(`Export em processamento (Job: ${result.jobId}). Você será notificado quando estiver pronto.`);
    } else {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div data-testid="export-dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Exportar Dados</h2>

        {/* Type selection */}
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium">Tipo de Dados</label>
          <select
            data-testid="select-type"
            value={selectedType}
            onChange={(e) => {
              const newType = e.target.value as ExportType;
              setSelectedType(newType);
              if (!PDF_SUPPORTED_TYPES.includes(newType) && format === 'pdf') {
                setFormat('xlsx');
              }
            }}
            className="w-full rounded border px-3 py-2 text-sm"
          >
            {EXPORT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Format selection */}
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium">Formato</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="format"
                value="xlsx"
                checked={format === 'xlsx'}
                onChange={() => setFormat('xlsx')}
              />
              Excel (.xlsx)
            </label>
            <label className={`flex items-center gap-2 text-sm ${!isPdfSupported ? 'opacity-40' : ''}`}>
              <input
                type="radio"
                name="format"
                value="pdf"
                checked={format === 'pdf'}
                onChange={() => setFormat('pdf')}
                disabled={!isPdfSupported}
              />
              PDF
            </label>
          </div>
          {!isPdfSupported && format !== 'pdf' && (
            <p className="mt-1 text-xs text-gray-400">PDF disponível apenas para Dashboard Executivo e Resumo MRP</p>
          )}
        </div>

        {/* Async notification */}
        {asyncMessage && (
          <div data-testid="async-message" className="mt-4 rounded bg-blue-50 p-3 text-sm text-blue-700">
            {asyncMessage}
          </div>
        )}

        {/* Export history */}
        {history.data && history.data.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-600">Exportações Recentes</h3>
            <div data-testid="export-history" className="mt-2 max-h-32 space-y-1 overflow-y-auto">
              {history.data.slice(0, 5).map((job) => (
                <div key={job.jobId} className="flex items-center justify-between rounded border px-3 py-1.5 text-xs">
                  <span>
                    {job.fileName}
                    <span className={`ml-2 ${job.status === 'COMPLETED' ? 'text-green-600' : job.status === 'FAILED' ? 'text-red-600' : 'text-yellow-600'}`}>
                      {job.status === 'COMPLETED' ? 'Concluído' : job.status === 'FAILED' ? 'Falhou' : 'Processando'}
                    </span>
                  </span>
                  {job.status === 'COMPLETED' && job.downloadUrl && (
                    <button
                      data-testid={`btn-download-${job.jobId}`}
                      className="text-blue-600 hover:underline"
                      onClick={() => downloadMutation.mutate(job.jobId)}
                    >
                      Baixar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            data-testid="btn-export"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={handleExport}
            disabled={exportMutation.isPending}
          >
            {exportMutation.isPending ? 'Exportando...' : 'Exportar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Export button to be placed on dashboard/table pages.
 *
 * @see Story 4.10 — AC-18
 */
export function ExportButton({ type, label }: { readonly type?: ExportType; readonly label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        data-testid="btn-open-export"
        className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
        onClick={() => setOpen(true)}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {label ?? 'Exportar'}
      </button>
      <ExportDialog defaultType={type} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
