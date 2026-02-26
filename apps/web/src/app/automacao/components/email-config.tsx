'use client';

import { useCallback } from 'react';
import type {
  EmailListenerConfig,
  EmailAdapterType,
  GmailConfig,
  ImapConfig,
  EmailSftpConfig,
  EmailFilters,
} from '@/types/automation';

interface EmailConfigProps {
  readonly config: EmailListenerConfig;
  readonly onChange: (config: EmailListenerConfig) => void;
}

const ADAPTER_TYPES: { value: EmailAdapterType; label: string }[] = [
  { value: 'GMAIL', label: 'Gmail (OAuth2)' },
  { value: 'IMAP', label: 'IMAP' },
  { value: 'SFTP', label: 'Pasta SFTP' },
];

function createDefaultGmail(): GmailConfig {
  return { clientId: '', clientSecret: '', refreshToken: '' };
}

function createDefaultImap(): ImapConfig {
  return { host: '', port: 993, username: '', password: '', tls: true };
}

function createDefaultSftp(): EmailSftpConfig {
  return {
    host: '',
    port: 22,
    username: '',
    remotePath: '/emails/',
    filePattern: '*.csv',
  };
}

export function EmailConfig({ config, onChange }: EmailConfigProps) {
  const updateField = useCallback(
    <K extends keyof EmailListenerConfig>(field: K, value: EmailListenerConfig[K]) => {
      onChange({ ...config, [field]: value });
    },
    [config, onChange],
  );

  const updateFilters = useCallback(
    (partial: Partial<EmailFilters>) => {
      onChange({ ...config, filters: { ...config.filters, ...partial } });
    },
    [config, onChange],
  );

  const updateGmail = useCallback(
    (partial: Partial<GmailConfig>) => {
      onChange({ ...config, gmail: { ...(config.gmail ?? createDefaultGmail()), ...partial } });
    },
    [config, onChange],
  );

  const updateImap = useCallback(
    (partial: Partial<ImapConfig>) => {
      onChange({ ...config, imap: { ...(config.imap ?? createDefaultImap()), ...partial } });
    },
    [config, onChange],
  );

  const updateSftp = useCallback(
    (partial: Partial<EmailSftpConfig>) => {
      onChange({ ...config, sftp: { ...(config.sftp ?? createDefaultSftp()), ...partial } });
    },
    [config, onChange],
  );

  const gmail = config.gmail ?? createDefaultGmail();
  const imap = config.imap ?? createDefaultImap();
  const sftp = config.sftp ?? createDefaultSftp();

  return (
    <div className="space-y-6">
      {/* Adapter Type + Schedule */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Adaptador de Email</label>
          <select
            className="w-full rounded border p-2"
            value={config.adapterType}
            onChange={(e) => updateField('adapterType', e.target.value as EmailAdapterType)}
          >
            {ADAPTER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Cron Schedule</label>
          <input
            type="text"
            className="w-full rounded border p-2 font-mono"
            placeholder="0 6 * * *"
            value={config.cronExpression}
            onChange={(e) => updateField('cronExpression', e.target.value)}
          />
          <span className="text-xs text-gray-500">Padrao: 06:00 diario</span>
        </div>
      </div>

      {/* Filters */}
      <fieldset className="border rounded p-4">
        <legend className="text-sm font-semibold px-2">Filtros de Email</legend>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Remetente</label>
              <input
                type="text"
                className="w-full rounded border p-2"
                placeholder="erp@empresa.com"
                value={config.filters.sender ?? ''}
                onChange={(e) => updateFilters({ sender: e.target.value || undefined })}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Padrao do Assunto</label>
              <input
                type="text"
                className="w-full rounded border p-2"
                placeholder="Fechamento|Relatorio diario"
                value={config.filters.subjectPattern ?? ''}
                onChange={(e) => updateFilters({ subjectPattern: e.target.value || undefined })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="hasAttachment"
              checked={config.filters.hasAttachment ?? true}
              onChange={(e) => updateFilters({ hasAttachment: e.target.checked })}
            />
            <label htmlFor="hasAttachment" className="text-sm">Apenas emails com anexo</label>
          </div>
        </div>
      </fieldset>

      {/* Attachment Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Tamanho maximo (MB)</label>
          <input
            type="number"
            className="w-full rounded border p-2"
            min={1}
            max={50}
            value={config.maxAttachmentSizeMb}
            onChange={(e) => updateField('maxAttachmentSizeMb', Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Extensoes permitidas</label>
          <input
            type="text"
            className="w-full rounded border p-2"
            placeholder=".csv, .xlsx, .pdf"
            value={Array.isArray(config.allowedExtensions) ? config.allowedExtensions.join(', ') : ''}
            onChange={(e) =>
              updateField(
                'allowedExtensions',
                e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              )
            }
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Template de Mapeamento (ID)</label>
        <input
          type="text"
          className="w-full rounded border p-2"
          placeholder="UUID do mapping template (opcional)"
          value={config.templateId ?? ''}
          onChange={(e) => updateField('templateId', e.target.value || undefined)}
        />
      </div>

      {/* Gmail Config */}
      {config.adapterType === 'GMAIL' && (
        <fieldset className="border rounded p-4">
          <legend className="text-sm font-semibold px-2">Gmail OAuth2</legend>
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Client ID</label>
              <input
                type="text"
                className="w-full rounded border p-2"
                value={gmail.clientId}
                onChange={(e) => updateGmail({ clientId: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Client Secret</label>
              <input
                type="password"
                className="w-full rounded border p-2"
                value={gmail.clientSecret}
                onChange={(e) => updateGmail({ clientSecret: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Refresh Token</label>
              <input
                type="password"
                className="w-full rounded border p-2"
                value={gmail.refreshToken}
                onChange={(e) => updateGmail({ refreshToken: e.target.value })}
              />
            </div>
          </div>
        </fieldset>
      )}

      {/* IMAP Config */}
      {config.adapterType === 'IMAP' && (
        <fieldset className="border rounded p-4">
          <legend className="text-sm font-semibold px-2">IMAP</legend>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Host</label>
                <input
                  type="text"
                  className="w-full rounded border p-2"
                  placeholder="imap.gmail.com"
                  value={imap.host}
                  onChange={(e) => updateImap({ host: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Porta</label>
                <input
                  type="number"
                  className="w-full rounded border p-2"
                  min={1}
                  max={65535}
                  value={imap.port}
                  onChange={(e) => updateImap({ port: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Usuario</label>
                <input
                  type="text"
                  className="w-full rounded border p-2"
                  value={imap.username}
                  onChange={(e) => updateImap({ username: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Senha</label>
                <input
                  type="password"
                  className="w-full rounded border p-2"
                  value={imap.password}
                  onChange={(e) => updateImap({ password: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="imapTls"
                checked={imap.tls}
                onChange={(e) => updateImap({ tls: e.target.checked })}
              />
              <label htmlFor="imapTls" className="text-sm">Usar TLS</label>
            </div>
          </div>
        </fieldset>
      )}

      {/* SFTP Config */}
      {config.adapterType === 'SFTP' && (
        <fieldset className="border rounded p-4">
          <legend className="text-sm font-semibold px-2">Pasta SFTP</legend>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Host</label>
                <input
                  type="text"
                  className="w-full rounded border p-2"
                  placeholder="sftp.empresa.com"
                  value={sftp.host}
                  onChange={(e) => updateSftp({ host: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Porta</label>
                <input
                  type="number"
                  className="w-full rounded border p-2"
                  min={1}
                  max={65535}
                  value={sftp.port}
                  onChange={(e) => updateSftp({ port: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Usuario</label>
                <input
                  type="text"
                  className="w-full rounded border p-2"
                  value={sftp.username}
                  onChange={(e) => updateSftp({ username: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Senha</label>
                <input
                  type="password"
                  className="w-full rounded border p-2"
                  value={sftp.password ?? ''}
                  onChange={(e) => updateSftp({ password: e.target.value || undefined })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1">Caminho Remoto</label>
              <input
                type="text"
                className="w-full rounded border p-2"
                placeholder="/emails/attachments/"
                value={sftp.remotePath}
                onChange={(e) => updateSftp({ remotePath: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Padrao de Arquivo</label>
              <input
                type="text"
                className="w-full rounded border p-2"
                placeholder="*.csv"
                value={sftp.filePattern}
                onChange={(e) => updateSftp({ filePattern: e.target.value })}
              />
            </div>
          </div>
        </fieldset>
      )}
    </div>
  );
}
