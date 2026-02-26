'use client';

import { useState } from 'react';
import { useEmailLogs, useTriggerEmailListener } from '@/hooks/use-email-listener';
import type { EmailProcessingResult } from '@/types/automation';

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function LogRow({ log }: { readonly log: EmailProcessingResult }) {
  const hasErrors = log.errors.length > 0;
  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-3 py-2 text-sm">{formatTimestamp(log.timestamp)}</td>
      <td className="px-3 py-2 text-sm text-center">{log.emailsFound}</td>
      <td className="px-3 py-2 text-sm text-center">{log.attachmentsProcessed}</td>
      <td className="px-3 py-2 text-sm text-center text-green-700">{log.rowsIngested}</td>
      <td className="px-3 py-2 text-sm">
        {hasErrors ? (
          <span className="text-red-600" title={log.errors.join('\n')}>
            {log.errors.length} erro(s)
          </span>
        ) : (
          <span className="text-green-600">OK</span>
        )}
      </td>
    </tr>
  );
}

/**
 * Email Listener Execution Logs page.
 * @see Story 4.3 — AC-14, AC-15
 */
export default function EmailLogPage() {
  const [limit, setLimit] = useState(20);
  const { data: logs, isLoading, error } = useEmailLogs(limit);
  const triggerEmail = useTriggerEmailListener();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Email Listener — Log de Execucao</h1>
        <div className="flex gap-2 items-center">
          <select
            className="rounded border p-2 text-sm"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={10}>10 registros</option>
            <option value={20}>20 registros</option>
            <option value={50}>50 registros</option>
            <option value={100}>100 registros</option>
          </select>
          <button
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
            onClick={() => triggerEmail.mutate()}
            disabled={triggerEmail.isPending}
          >
            {triggerEmail.isPending ? 'Executando...' : 'Executar Agora'}
          </button>
        </div>
      </div>

      {triggerEmail.data && (
        <div className="mb-4 p-3 rounded bg-green-50 text-green-700 border border-green-200 text-sm">
          Execucao concluida: {triggerEmail.data.emailsFound} emails,{' '}
          {triggerEmail.data.attachmentsProcessed} anexos processados,{' '}
          {triggerEmail.data.rowsIngested} linhas ingeridas.
          {triggerEmail.data.errors.length > 0 && (
            <span className="text-red-600 ml-2">
              ({triggerEmail.data.errors.length} erros)
            </span>
          )}
        </div>
      )}

      {triggerEmail.error && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm">
          Erro ao executar: {(triggerEmail.error as Error).message}
        </div>
      )}

      {isLoading && <p className="text-gray-500">Carregando logs...</p>}
      {error && (
        <p className="text-yellow-600">Nenhum log encontrado ainda.</p>
      )}

      {logs && logs.length > 0 ? (
        <div className="border rounded overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-sm text-left font-medium">Timestamp</th>
                <th className="px-3 py-2 text-sm text-center font-medium">Emails</th>
                <th className="px-3 py-2 text-sm text-center font-medium">Anexos</th>
                <th className="px-3 py-2 text-sm text-center font-medium">Linhas</th>
                <th className="px-3 py-2 text-sm text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => (
                <LogRow key={`${log.timestamp}-${idx}`} log={log} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !isLoading && <p className="text-gray-500 mt-4">Nenhum log de execucao registrado.</p>
      )}
    </div>
  );
}
