'use client';

import { useState } from 'react';
import {
  useEmailConfig,
  useEmailHistory,
  useSendSummary,
  useSendBriefing,
  useUpdateEmailConfig,
} from '@/hooks/use-emails';
import {
  EMAIL_TYPE_LABELS,
  EMAIL_STATUS_LABELS,
  EMAIL_STATUS_COLORS,
} from '@/types/email';
import type { EmailFullConfig, EmailType, EmailSendStatus } from '@/types/email';

function formatDateTime(iso: string | null): string {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ────────────────────────────────────────────────────────────────
// Send Actions
// ────────────────────────────────────────────────────────────────

function SendActions() {
  const summaryMutation = useSendSummary();
  const briefingMutation = useSendBriefing();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6" data-testid="send-actions">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Enviar Email</h2>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => summaryMutation.mutate()}
          disabled={summaryMutation.isPending}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          data-testid="send-summary-btn"
        >
          {summaryMutation.isPending ? 'Enviando...' : 'Enviar Resumo Diario'}
        </button>
        <button
          type="button"
          onClick={() => briefingMutation.mutate()}
          disabled={briefingMutation.isPending}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          data-testid="send-briefing-btn"
        >
          {briefingMutation.isPending ? 'Enviando...' : 'Enviar Briefing Matinal'}
        </button>
      </div>

      {summaryMutation.isSuccess && (
        <div className="mt-3 p-3 rounded bg-green-50 text-green-700 border border-green-200 text-sm" data-testid="summary-success">
          Resumo diario enviado com sucesso
        </div>
      )}
      {summaryMutation.isError && (
        <div className="mt-3 p-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm" data-testid="summary-error">
          Erro ao enviar resumo: {summaryMutation.error.message}
        </div>
      )}
      {briefingMutation.isSuccess && (
        <div className="mt-3 p-3 rounded bg-green-50 text-green-700 border border-green-200 text-sm" data-testid="briefing-success">
          Briefing matinal enviado com sucesso
        </div>
      )}
      {briefingMutation.isError && (
        <div className="mt-3 p-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm" data-testid="briefing-error">
          Erro ao enviar briefing: {briefingMutation.error.message}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Config Panel
// ────────────────────────────────────────────────────────────────

function ConfigPanel() {
  const { data: config, isLoading } = useEmailConfig();
  const updateMutation = useUpdateEmailConfig();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  const startEdit = () => {
    if (!config) return;
    setForm({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      user: config.smtp.user,
      pass: '',
      fromAddress: config.smtp.fromAddress,
      fromName: config.smtp.fromName,
      summaryRecipients: config.recipients.summary,
      briefingRecipients: config.recipients.briefing,
      cc: config.recipients.cc,
      bcc: config.recipients.bcc,
    });
    setEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate(form, {
      onSuccess: () => setEditing(false),
    });
  };

  if (isLoading) {
    return <p className="text-gray-500" data-testid="config-loading">Carregando configuracao...</p>;
  }

  if (!config) {
    return <p className="text-gray-400">Configuracao nao disponivel</p>;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mt-6" data-testid="config-panel">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Configuracao SMTP</h2>
        {!editing ? (
          <button
            type="button"
            onClick={startEdit}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            data-testid="edit-config-btn"
          >
            Editar
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              data-testid="save-config-btn"
            >
              {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {updateMutation.isError && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm" data-testid="config-error">
          Erro ao salvar: {updateMutation.error.message}
        </div>
      )}

      {!editing ? (
        <ConfigView config={config} />
      ) : (
        <ConfigForm form={form} onChange={setForm} />
      )}
    </div>
  );
}

function ConfigView({ config }: { readonly config: EmailFullConfig }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm" data-testid="config-view">
      <div>
        <h3 className="font-medium text-gray-700 mb-2">SMTP</h3>
        <dl className="space-y-1">
          <div><dt className="text-gray-500 inline">Host:</dt> <dd className="inline text-gray-800">{config.smtp.host}</dd></div>
          <div><dt className="text-gray-500 inline">Porta:</dt> <dd className="inline text-gray-800">{config.smtp.port}</dd></div>
          <div><dt className="text-gray-500 inline">SSL:</dt> <dd className="inline text-gray-800">{config.smtp.secure ? 'Sim' : 'Nao'}</dd></div>
          <div><dt className="text-gray-500 inline">Usuario:</dt> <dd className="inline text-gray-800">{config.smtp.user || '\u2014'}</dd></div>
          <div><dt className="text-gray-500 inline">Senha:</dt> <dd className="inline text-gray-800">{config.smtp.pass ? '********' : '\u2014'}</dd></div>
          <div><dt className="text-gray-500 inline">De:</dt> <dd className="inline text-gray-800">{config.smtp.fromName} &lt;{config.smtp.fromAddress}&gt;</dd></div>
        </dl>
      </div>
      <div>
        <h3 className="font-medium text-gray-700 mb-2">Destinatarios</h3>
        <dl className="space-y-1">
          <div><dt className="text-gray-500 inline">Resumo:</dt> <dd className="inline text-gray-800">{config.recipients.summary.join(', ') || '\u2014'}</dd></div>
          <div><dt className="text-gray-500 inline">Briefing:</dt> <dd className="inline text-gray-800">{config.recipients.briefing.join(', ') || '\u2014'}</dd></div>
          <div><dt className="text-gray-500 inline">CC:</dt> <dd className="inline text-gray-800">{config.recipients.cc.join(', ') || '\u2014'}</dd></div>
          <div><dt className="text-gray-500 inline">BCC:</dt> <dd className="inline text-gray-800">{config.recipients.bcc.join(', ') || '\u2014'}</dd></div>
        </dl>
      </div>
    </div>
  );
}

function ConfigForm({
  form,
  onChange,
}: {
  readonly form: Record<string, unknown>;
  readonly onChange: (f: Record<string, unknown>) => void;
}) {
  const set = (key: string, value: unknown) => onChange({ ...form, [key]: value });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm" data-testid="config-form">
      <div className="space-y-3">
        <h3 className="font-medium text-gray-700">SMTP</h3>
        <label className="block">
          <span className="text-gray-500">Host</span>
          <input type="text" value={String(form.host ?? '')} onChange={(e) => set('host', e.target.value)} className="mt-1 block w-full border rounded px-3 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-gray-500">Porta</span>
          <input type="number" value={Number(form.port ?? 587)} onChange={(e) => set('port', Number(e.target.value))} className="mt-1 block w-full border rounded px-3 py-1.5 text-sm" />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={Boolean(form.secure)} onChange={(e) => set('secure', e.target.checked)} />
          <span className="text-gray-500">SSL/TLS</span>
        </label>
        <label className="block">
          <span className="text-gray-500">Usuario</span>
          <input type="text" value={String(form.user ?? '')} onChange={(e) => set('user', e.target.value)} className="mt-1 block w-full border rounded px-3 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-gray-500">Senha</span>
          <input type="password" value={String(form.pass ?? '')} onChange={(e) => set('pass', e.target.value)} className="mt-1 block w-full border rounded px-3 py-1.5 text-sm" placeholder="Deixe vazio para manter" />
        </label>
        <label className="block">
          <span className="text-gray-500">Email Remetente</span>
          <input type="text" value={String(form.fromAddress ?? '')} onChange={(e) => set('fromAddress', e.target.value)} className="mt-1 block w-full border rounded px-3 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-gray-500">Nome Remetente</span>
          <input type="text" value={String(form.fromName ?? '')} onChange={(e) => set('fromName', e.target.value)} className="mt-1 block w-full border rounded px-3 py-1.5 text-sm" />
        </label>
      </div>
      <div className="space-y-3">
        <h3 className="font-medium text-gray-700">Destinatarios</h3>
        <label className="block">
          <span className="text-gray-500">Resumo (virgula separa)</span>
          <input
            type="text"
            value={(form.summaryRecipients as string[])?.join(', ') ?? ''}
            onChange={(e) => set('summaryRecipients', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            className="mt-1 block w-full border rounded px-3 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-gray-500">Briefing (virgula separa)</span>
          <input
            type="text"
            value={(form.briefingRecipients as string[])?.join(', ') ?? ''}
            onChange={(e) => set('briefingRecipients', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            className="mt-1 block w-full border rounded px-3 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-gray-500">CC (virgula separa)</span>
          <input
            type="text"
            value={(form.cc as string[])?.join(', ') ?? ''}
            onChange={(e) => set('cc', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            className="mt-1 block w-full border rounded px-3 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-gray-500">BCC (virgula separa)</span>
          <input
            type="text"
            value={(form.bcc as string[])?.join(', ') ?? ''}
            onChange={(e) => set('bcc', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            className="mt-1 block w-full border rounded px-3 py-1.5 text-sm"
          />
        </label>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// History Table
// ────────────────────────────────────────────────────────────────

function HistoryTable() {
  const [page, setPage] = useState(1);
  const { data: history, isLoading } = useEmailHistory(page);

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Historico de Envios</h2>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm" data-testid="email-history-table">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Destinatarios</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Enviado Em</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Erro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Carregando...
                </td>
              </tr>
            )}

            {!isLoading && (!history?.data || history.data.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400" data-testid="no-email-history">
                  Nenhum envio encontrado
                </td>
              </tr>
            )}

            {history?.data.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50" data-testid="email-history-row">
                <td className="px-4 py-3 text-gray-700">
                  {EMAIL_TYPE_LABELS[entry.tipo as EmailType] ?? entry.tipo}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded ${EMAIL_STATUS_COLORS[entry.statusEnvio as EmailSendStatus]}`}>
                    {EMAIL_STATUS_LABELS[entry.statusEnvio as EmailSendStatus] ?? entry.statusEnvio}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                  {entry.destinatarios.join(', ') || '\u2014'}
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {formatDateTime(entry.enviadoEm)}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                  {entry.ultimoErro ?? '\u2014'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {history && history.meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4" data-testid="email-pagination">
          <p className="text-sm text-gray-500">
            Pagina {history.meta.page} de {history.meta.totalPages} ({history.meta.total} total)
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!history.meta.hasPrev}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!history.meta.hasNext}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Proximo
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────

/**
 * Email Management Page
 *
 * Shows SMTP config, send actions, and delivery history.
 *
 * @see Story 4.7 — AC-13 through AC-18
 */
export default function EmailsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Emails Automaticos
      </h1>

      <SendActions />
      <ConfigPanel />
      <HistoryTable />
    </div>
  );
}
