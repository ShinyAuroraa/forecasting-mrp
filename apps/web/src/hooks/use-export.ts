import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ExportRequest, ExportJobResult, AsyncExportResponse, ExportFormat } from '@/types/export';

const EXPORT_KEYS = {
  history: ['export', 'history'] as const,
};

/**
 * Hook to request an Excel/PDF export.
 *
 * @see Story 4.10 — AC-18, AC-19
 */
export function useRequestExport() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ request, format }: { request: ExportRequest; format: ExportFormat }) => {
      const endpoint = format === 'xlsx' ? '/export/excel' : '/export/pdf';

      // First check if export will be async (large dataset)
      const response = await api.post(endpoint, request, { responseType: 'blob' });

      // If 202: async job queued — parse JSON from Blob
      if (response.status === 202) {
        try {
          const text = await (response.data as Blob).text();
          const asyncResult: AsyncExportResponse = JSON.parse(text);
          return { async: true as const, ...asyncResult };
        } catch {
          return { async: true as const, jobId: '', message: 'Export em processamento', downloadUrl: '' };
        }
      }

      // Sync: download the file directly
      const blob = response.data as Blob;
      const disposition = response.headers['content-disposition'] ?? '';
      const match = disposition.match(/filename\*?=(?:UTF-8'')?(.+)/);
      const fileName = match ? decodeURIComponent(match[1]) : `export.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      return { async: false as const };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EXPORT_KEYS.history });
    },
  });
}

/**
 * Hook to download an async export by job ID.
 *
 * @see Story 4.10 — AC-16
 */
export function useDownloadExport() {
  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await api.get(`/export/${jobId}/download`, { responseType: 'blob' });
      const blob = response.data as Blob;
      const disposition = response.headers['content-disposition'] ?? '';
      const fileName = disposition.match(/filename="?(.+)"?/)?.[1] ?? 'export';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

/**
 * Hook to list export history.
 *
 * @see Story 4.10 — AC-17
 */
export function useExportHistory() {
  return useQuery({
    queryKey: EXPORT_KEYS.history,
    queryFn: async () => {
      const { data } = await api.get<ExportJobResult[]>('/export/history');
      return data;
    },
    refetchInterval: 30_000,
  });
}
