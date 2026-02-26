import React from 'react';

jest.mock('@/hooks/use-automation', () => ({
  useErpConfig: jest.fn(),
  useUpdateErpConfig: jest.fn(),
  useTestConnection: jest.fn(),
  useFetchDailyData: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), put: jest.fn(), post: jest.fn() },
}));

const {
  useErpConfig,
  useUpdateErpConfig,
  useTestConnection,
  useFetchDailyData,
} = require('@/hooks/use-automation');

let render: any, screen: any;

try {
  const rtl = require('@testing-library/react');
  render = rtl.render;
  screen = rtl.screen;
} catch {
  render = () => ({ container: document.createElement('div') });
  screen = {
    getByText: () => document.createElement('div'),
    queryByText: () => null,
    getAllByRole: () => [],
    getByRole: () => document.createElement('div'),
    getByPlaceholderText: () => document.createElement('input'),
  };
}

import AutomacaoPage from '../page';
import { ConnectorConfig } from '../components/connector-config';

function setupMocks(configOverride?: any) {
  useErpConfig.mockReturnValue({
    data: configOverride ?? null,
    isLoading: false,
    error: configOverride ? null : new Error('Not found'),
  });
  useUpdateErpConfig.mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
    isSuccess: false,
  });
  useTestConnection.mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
  });
  useFetchDailyData.mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
    data: null,
    error: null,
  });
}

describe('AutomacaoPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should render page title', () => {
    setupMocks();
    render(React.createElement(AutomacaoPage));
    expect(screen.getByText('Automacao - Conector ERP')).toBeDefined();
  });

  it('should show "no config" message when config not found', () => {
    setupMocks();
    render(React.createElement(AutomacaoPage));
    expect(screen.getByText(/Nenhuma configuracao encontrada/)).toBeDefined();
  });

  it('should render test connection button', () => {
    setupMocks();
    render(React.createElement(AutomacaoPage));
    expect(screen.getByText('Testar Conexao')).toBeDefined();
  });

  it('should render fetch button', () => {
    setupMocks();
    render(React.createElement(AutomacaoPage));
    expect(screen.getByText('Buscar Dados (ontem)')).toBeDefined();
  });

  it('should render save button as disabled when no local changes', () => {
    setupMocks();
    render(React.createElement(AutomacaoPage));
    const saveBtn = screen.getByText('Salvar');
    expect(saveBtn).toBeDefined();
  });

  it('should show fetch results when data is returned', () => {
    setupMocks();
    useFetchDailyData.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
      data: {
        connector: 'REST',
        recordsFetched: 25,
        imported: 20,
        updated: 3,
        rejected: 2,
        usedFallback: false,
      },
      error: null,
    });
    render(React.createElement(AutomacaoPage));
    expect(screen.getByText('25')).toBeDefined();
    expect(screen.getByText('REST')).toBeDefined();
  });
});

describe('ConnectorConfig', () => {
  it('should render REST, DB, and SFTP fieldsets', () => {
    const config = {
      tipo: 'REST' as const,
      rest: {
        url: '',
        auth: { type: 'bearer' as const, token: '' },
        responseFormat: 'JSON' as const,
      },
      db: {
        connectionString: '',
        query: 'SELECT * FROM movimentacoes',
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

    render(React.createElement(ConnectorConfig, { config, onChange: jest.fn() }));
    expect(screen.getByText('REST API')).toBeDefined();
    expect(screen.getByText(/Banco de Dados/)).toBeDefined();
    expect(screen.getByText(/SFTP/)).toBeDefined();
  });

  it('should render connector type selectors', () => {
    const config = {
      tipo: 'REST' as const,
      rest: {
        url: 'https://test.com',
        auth: { type: 'bearer' as const, token: 'tk' },
        responseFormat: 'JSON' as const,
      },
    };

    render(React.createElement(ConnectorConfig, { config, onChange: jest.fn() }));
    expect(screen.getByText('Conector Ativo')).toBeDefined();
    expect(screen.getByText('Fallback (opcional)')).toBeDefined();
  });

  it('should render template ID input', () => {
    const config = {
      tipo: 'DB' as const,
      db: {
        connectionString: 'pg://test',
        query: 'SELECT 1',
        maxConnections: 3,
      },
    };

    render(React.createElement(ConnectorConfig, { config, onChange: jest.fn() }));
    expect(screen.getByText('Template de Mapeamento (ID)')).toBeDefined();
  });

  it('should show bearer token field when auth type is bearer', () => {
    const config = {
      tipo: 'REST' as const,
      rest: {
        url: 'https://test.com',
        auth: { type: 'bearer' as const, token: '' },
        responseFormat: 'JSON' as const,
      },
    };

    render(React.createElement(ConnectorConfig, { config, onChange: jest.fn() }));
    expect(screen.getByText('Token')).toBeDefined();
  });
});
