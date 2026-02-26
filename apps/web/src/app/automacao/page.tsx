'use client';

import { useState, useCallback } from 'react';
import { ConnectorConfig } from './components/connector-config';
import { EmailConfig } from './components/email-config';
import {
  useErpConfig,
  useUpdateErpConfig,
  useTestConnection,
  useFetchDailyData,
} from '@/hooks/use-automation';
import {
  useEmailConfig,
  useUpdateEmailConfig,
  useTestEmailConnection,
} from '@/hooks/use-email-listener';
import type { ErpConfig, ConnectorType, EmailListenerConfig } from '@/types/automation';

const DEFAULT_EMAIL_CONFIG: EmailListenerConfig = {
  adapterType: 'IMAP',
  filters: { hasAttachment: true },
  cronExpression: '0 6 * * *',
  maxAttachmentSizeMb: 25,
  allowedExtensions: ['.csv', '.xlsx', '.pdf'],
};

const DEFAULT_CONFIG: ErpConfig = {
  tipo: 'REST',
  rest: {
    url: '',
    auth: { type: 'bearer', token: '' },
    queryParams: { data: '{yesterday}' },
    responseFormat: 'JSON',
  },
  db: {
    connectionString: '',
    query: 'SELECT * FROM movimentacoes WHERE data_movimento = $1',
    maxConnections: 5,
  },
  sftp: {
    host: '',
    port: 22,
    username: '',
    remotePath: '/data/',
    filePattern: 'fechamento_*.csv',
    pollIntervalMinutes: 60,
  },
};

export default function AutomacaoPage() {
  const { data: savedConfig, isLoading, error } = useErpConfig();
  const updateConfig = useUpdateErpConfig();
  const testConnection = useTestConnection();
  const fetchData = useFetchDailyData();

  const { data: savedEmailConfig, isLoading: emailLoading } = useEmailConfig();
  const updateEmailConfig = useUpdateEmailConfig();
  const testEmailConnection = useTestEmailConnection();

  const [localConfig, setLocalConfig] = useState<ErpConfig | null>(null);
  const [localEmailConfig, setLocalEmailConfig] = useState<EmailListenerConfig | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'erp' | 'email'>('erp');

  const config = localConfig ?? savedConfig ?? DEFAULT_CONFIG;
  const emailConfig = localEmailConfig ?? savedEmailConfig ?? DEFAULT_EMAIL_CONFIG;

  const handleChange = useCallback((newConfig: ErpConfig) => {
    setLocalConfig(newConfig);
    setTestResult(null);
  }, []);

  const handleSave = useCallback(() => {
    updateConfig.mutate(config, {
      onSuccess: () => setLocalConfig(null),
    });
  }, [config, updateConfig]);

  const handleTest = useCallback(
    (tipo?: ConnectorType) => {
      setTestResult(null);
      testConnection.mutate(tipo, {
        onSuccess: (result) => setTestResult(result),
        onError: () => setTestResult({ success: false, error: 'Falha ao testar conexao' }),
      });
    },
    [testConnection],
  );

  const handleFetch = useCallback(() => {
    fetchData.mutate(undefined);
  }, [fetchData]);

  const handleEmailChange = useCallback((newConfig: EmailListenerConfig) => {
    setLocalEmailConfig(newConfig);
    setEmailTestResult(null);
  }, []);

  const handleEmailSave = useCallback(() => {
    updateEmailConfig.mutate(emailConfig, {
      onSuccess: () => setLocalEmailConfig(null),
    });
  }, [emailConfig, updateEmailConfig]);

  const handleEmailTest = useCallback(() => {
    setEmailTestResult(null);
    testEmailConnection.mutate(undefined, {
      onSuccess: (result) => setEmailTestResult(result),
      onError: () => setEmailTestResult({ success: false, error: 'Falha ao testar conexao' }),
    });
  }, [testEmailConnection]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Automacao</h1>

      {/* Tab Navigation */}
      <div className="flex border-b mb-6">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'erp'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('erp')}
        >
          Conector ERP
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'email'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('email')}
        >
          Email Listener
        </button>
      </div>

      {/* ERP Tab */}
      {activeTab === 'erp' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Conector ERP</h2>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                onClick={() => handleTest()}
                disabled={testConnection.isPending}
              >
                {testConnection.isPending ? 'Testando...' : 'Testar Conexao'}
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={handleSave}
                disabled={updateConfig.isPending || !localConfig}
              >
                {updateConfig.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>

          {isLoading && <p className="text-gray-500">Carregando configuracao...</p>}
          {error && !savedConfig && (
            <p className="text-yellow-600 mb-4">
              Nenhuma configuracao encontrada. Configure o conector ERP abaixo.
            </p>
          )}

          {testResult && (
            <div
              className={`mb-4 p-3 rounded ${
                testResult.success
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {testResult.success
                ? 'Conexao bem-sucedida!'
                : `Falha na conexao: ${testResult.error ?? 'Erro desconhecido'}`}
            </div>
          )}

          {updateConfig.isSuccess && (
            <div className="mb-4 p-3 rounded bg-green-50 text-green-700 border border-green-200">
              Configuracao salva com sucesso!
            </div>
          )}

          <ConnectorConfig config={config} onChange={handleChange} />

          <div className="mt-6 border rounded p-4">
            <h2 className="text-lg font-semibold mb-3">Busca Manual</h2>
            <div className="flex items-center gap-4">
              <button
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                onClick={handleFetch}
                disabled={fetchData.isPending}
              >
                {fetchData.isPending ? 'Buscando dados...' : 'Buscar Dados (ontem)'}
              </button>
              {fetchData.data && (
                <div className="text-sm">
                  <span className="font-medium">{fetchData.data.recordsFetched}</span> registros via{' '}
                  <span className="font-medium">{fetchData.data.connector}</span>
                  {fetchData.data.usedFallback && (
                    <span className="text-yellow-600 ml-1">(fallback)</span>
                  )}
                  {' | '}
                  <span className="text-green-600">{fetchData.data.imported} importados</span>
                  {fetchData.data.updated > 0 && (
                    <span className="text-blue-600">, {fetchData.data.updated} atualizados</span>
                  )}
                  {fetchData.data.rejected > 0 && (
                    <span className="text-red-600">, {fetchData.data.rejected} rejeitados</span>
                  )}
                </div>
              )}
            </div>
            {fetchData.error && (
              <p className="text-red-600 mt-2 text-sm">
                Erro ao buscar dados: {(fetchData.error as Error).message}
              </p>
            )}
          </div>
        </>
      )}

      {/* Email Listener Tab */}
      {activeTab === 'email' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Email Listener</h2>
            <div className="flex gap-2">
              <a
                href="/automacao/log"
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
              >
                Ver Logs
              </a>
              <button
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                onClick={handleEmailTest}
                disabled={testEmailConnection.isPending}
              >
                {testEmailConnection.isPending ? 'Testando...' : 'Testar Conexao'}
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={handleEmailSave}
                disabled={updateEmailConfig.isPending || !localEmailConfig}
              >
                {updateEmailConfig.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>

          {emailLoading && <p className="text-gray-500">Carregando configuracao...</p>}

          {emailTestResult && (
            <div
              className={`mb-4 p-3 rounded ${
                emailTestResult.success
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {emailTestResult.success
                ? 'Conexao de email bem-sucedida!'
                : `Falha na conexao: ${emailTestResult.error ?? 'Erro desconhecido'}`}
            </div>
          )}

          {updateEmailConfig.isSuccess && (
            <div className="mb-4 p-3 rounded bg-green-50 text-green-700 border border-green-200">
              Configuracao de email salva com sucesso!
            </div>
          )}

          <EmailConfig config={emailConfig} onChange={handleEmailChange} />
        </>
      )}
    </div>
  );
}
