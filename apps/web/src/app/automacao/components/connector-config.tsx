'use client';

import { useCallback } from 'react';
import type {
  ErpConfig,
  ConnectorType,
  RestConnectorConfig,
  DbConnectorConfig,
  SftpConnectorConfig,
  RestAuth,
} from '@/types/automation';

interface ConnectorConfigProps {
  readonly config: ErpConfig;
  readonly onChange: (config: ErpConfig) => void;
}

const CONNECTOR_TYPES: { value: ConnectorType; label: string }[] = [
  { value: 'REST', label: 'REST API' },
  { value: 'DB', label: 'Banco de Dados (read-only)' },
  { value: 'SFTP', label: 'SFTP / Pasta' },
];

const AUTH_TYPES: { value: RestAuth['type']; label: string }[] = [
  { value: 'apiKey', label: 'API Key' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic (Usuário/Senha)' },
];

function createDefaultRest(): RestConnectorConfig {
  return {
    url: '',
    auth: { type: 'bearer', token: '' },
    queryParams: { data: '{yesterday}' },
    responseFormat: 'JSON',
    dataPath: '',
  };
}

function createDefaultDb(): DbConnectorConfig {
  return {
    connectionString: '',
    query: 'SELECT * FROM movimentacoes WHERE data_movimento = $1',
    maxConnections: 5,
  };
}

function createDefaultSftp(): SftpConnectorConfig {
  return {
    host: '',
    port: 22,
    username: '',
    password: '',
    remotePath: '/data/',
    filePattern: 'fechamento_*.csv',
    pollIntervalMinutes: 60,
  };
}

export function ConnectorConfig({ config, onChange }: ConnectorConfigProps) {
  const updateField = useCallback(
    <K extends keyof ErpConfig>(field: K, value: ErpConfig[K]) => {
      onChange({ ...config, [field]: value });
    },
    [config, onChange],
  );

  const updateRest = useCallback(
    (partial: Partial<RestConnectorConfig>) => {
      onChange({ ...config, rest: { ...(config.rest ?? createDefaultRest()), ...partial } });
    },
    [config, onChange],
  );

  const updateRestAuth = useCallback(
    (partial: Partial<RestAuth>) => {
      const currentRest = config.rest ?? createDefaultRest();
      onChange({
        ...config,
        rest: { ...currentRest, auth: { ...currentRest.auth, ...partial } },
      });
    },
    [config, onChange],
  );

  const updateDb = useCallback(
    (partial: Partial<DbConnectorConfig>) => {
      onChange({ ...config, db: { ...(config.db ?? createDefaultDb()), ...partial } });
    },
    [config, onChange],
  );

  const updateSftp = useCallback(
    (partial: Partial<SftpConnectorConfig>) => {
      onChange({ ...config, sftp: { ...(config.sftp ?? createDefaultSftp()), ...partial } });
    },
    [config, onChange],
  );

  const rest = config.rest ?? createDefaultRest();
  const db = config.db ?? createDefaultDb();
  const sftp = config.sftp ?? createDefaultSftp();

  return (
    <div className="space-y-6">
      {/* Connector Type Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Conector Ativo</label>
          <select
            className="w-full rounded border p-2"
            value={config.tipo}
            onChange={(e) => updateField('tipo', e.target.value as ConnectorType)}
          >
            {CONNECTOR_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fallback (opcional)</label>
          <select
            className="w-full rounded border p-2"
            value={config.fallback ?? ''}
            onChange={(e) => updateField('fallback', (e.target.value || undefined) as ConnectorType | undefined)}
          >
            <option value="">Nenhum</option>
            {CONNECTOR_TYPES.filter((t) => t.value !== config.tipo).map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
        <div>
          <label className="block text-sm font-medium mb-1">Granularidade</label>
          <select
            className="w-full rounded border p-2"
            value={config.granularidade ?? 'diario'}
            onChange={(e) => updateField('granularidade', e.target.value as ErpConfig['granularidade'])}
          >
            <option value="diario">Diario</option>
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
          </select>
        </div>
      </div>

      {/* REST Config */}
      <fieldset className="border rounded p-4">
        <legend className="text-sm font-semibold px-2">REST API</legend>
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">URL do Endpoint</label>
            <input
              type="url"
              className="w-full rounded border p-2"
              placeholder="https://erp.example.com/api/movimentacoes"
              value={rest.url}
              onChange={(e) => updateRest({ url: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Autenticacao</label>
              <select
                className="w-full rounded border p-2"
                value={rest.auth.type}
                onChange={(e) => updateRestAuth({ type: e.target.value as RestAuth['type'] })}
              >
                {AUTH_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Formato Resposta</label>
              <select
                className="w-full rounded border p-2"
                value={rest.responseFormat}
                onChange={(e) => updateRest({ responseFormat: e.target.value as 'JSON' | 'XML' })}
              >
                <option value="JSON">JSON</option>
                <option value="XML">XML</option>
              </select>
            </div>
          </div>
          {rest.auth.type === 'apiKey' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Header Name</label>
                <input
                  type="text"
                  className="w-full rounded border p-2"
                  value={rest.auth.headerName ?? 'X-API-Key'}
                  onChange={(e) => updateRestAuth({ headerName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">API Key</label>
                <input
                  type="password"
                  className="w-full rounded border p-2"
                  value={rest.auth.apiKey ?? ''}
                  onChange={(e) => updateRestAuth({ apiKey: e.target.value })}
                />
              </div>
            </div>
          )}
          {rest.auth.type === 'bearer' && (
            <div>
              <label className="block text-sm mb-1">Token</label>
              <input
                type="password"
                className="w-full rounded border p-2"
                value={rest.auth.token ?? ''}
                onChange={(e) => updateRestAuth({ token: e.target.value })}
              />
            </div>
          )}
          {rest.auth.type === 'basic' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Usuario</label>
                <input
                  type="text"
                  className="w-full rounded border p-2"
                  value={rest.auth.username ?? ''}
                  onChange={(e) => updateRestAuth({ username: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Senha</label>
                <input
                  type="password"
                  className="w-full rounded border p-2"
                  value={rest.auth.password ?? ''}
                  onChange={(e) => updateRestAuth({ password: e.target.value })}
                />
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm mb-1">Data Path (caminho JSON para array de dados)</label>
            <input
              type="text"
              className="w-full rounded border p-2"
              placeholder="data.items"
              value={rest.dataPath ?? ''}
              onChange={(e) => updateRest({ dataPath: e.target.value || undefined })}
            />
          </div>
        </div>
      </fieldset>

      {/* DB Config */}
      <fieldset className="border rounded p-4">
        <legend className="text-sm font-semibold px-2">Banco de Dados (read-only)</legend>
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Connection String</label>
            <input
              type="password"
              className="w-full rounded border p-2"
              placeholder="postgresql://user:pass@host:5432/erp_db"
              value={db.connectionString}
              onChange={(e) => updateDb({ connectionString: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Query SQL</label>
            <textarea
              className="w-full rounded border p-2 font-mono text-sm"
              rows={3}
              value={db.query}
              onChange={(e) => updateDb({ query: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Max Connections (1-5)</label>
            <input
              type="number"
              className="w-full rounded border p-2"
              min={1}
              max={5}
              value={db.maxConnections}
              onChange={(e) => updateDb({ maxConnections: Number(e.target.value) })}
            />
          </div>
        </div>
      </fieldset>

      {/* SFTP Config */}
      <fieldset className="border rounded p-4">
        <legend className="text-sm font-semibold px-2">SFTP / Pasta</legend>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Host</label>
              <input
                type="text"
                className="w-full rounded border p-2"
                placeholder="sftp.example.com"
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
                onChange={(e) => updateSftp({ password: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Caminho Remoto</label>
            <input
              type="text"
              className="w-full rounded border p-2"
              placeholder="/data/exports/"
              value={sftp.remotePath}
              onChange={(e) => updateSftp({ remotePath: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Padrao de Arquivo</label>
              <input
                type="text"
                className="w-full rounded border p-2"
                placeholder="fechamento_*.csv"
                value={sftp.filePattern}
                onChange={(e) => updateSftp({ filePattern: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Intervalo Polling (min)</label>
              <input
                type="number"
                className="w-full rounded border p-2"
                min={5}
                max={1440}
                value={sftp.pollIntervalMinutes}
                onChange={(e) => updateSftp({ pollIntervalMinutes: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
