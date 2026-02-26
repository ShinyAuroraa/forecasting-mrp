import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/hooks/use-email-listener', () => ({
  useEmailLogs: jest.fn(),
  useTriggerEmailListener: jest.fn(),
}));

import { useEmailLogs, useTriggerEmailListener } from '@/hooks/use-email-listener';
import EmailLogPage from '../log/page';

const mockUseEmailLogs = useEmailLogs as jest.MockedFunction<typeof useEmailLogs>;
const mockUseTrigger = useTriggerEmailListener as jest.MockedFunction<typeof useTriggerEmailListener>;

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('EmailLogPage', () => {
  beforeEach(() => {
    mockUseTrigger.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
      data: undefined,
      error: null,
    } as any);
  });

  it('should render page title', () => {
    mockUseEmailLogs.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    renderWithQuery(<EmailLogPage />);
    expect(screen.getByText('Email Listener — Log de Execucao')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    mockUseEmailLogs.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    renderWithQuery(<EmailLogPage />);
    expect(screen.getByText('Carregando logs...')).toBeInTheDocument();
  });

  it('should render logs table when data exists', () => {
    mockUseEmailLogs.mockReturnValue({
      data: [
        {
          emailsFound: 5,
          attachmentsProcessed: 3,
          rowsIngested: 150,
          errors: [],
          timestamp: '2026-02-26T06:00:00Z',
        },
      ],
      isLoading: false,
      error: null,
    } as any);

    renderWithQuery(<EmailLogPage />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('should show error count for logs with errors', () => {
    mockUseEmailLogs.mockReturnValue({
      data: [
        {
          emailsFound: 2,
          attachmentsProcessed: 1,
          rowsIngested: 50,
          errors: ['file.csv: Extension not allowed'],
          timestamp: '2026-02-26T06:00:00Z',
        },
      ],
      isLoading: false,
      error: null,
    } as any);

    renderWithQuery(<EmailLogPage />);
    expect(screen.getByText('1 erro(s)')).toBeInTheDocument();
  });

  it('should show empty state when no logs', () => {
    mockUseEmailLogs.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    renderWithQuery(<EmailLogPage />);
    expect(screen.getByText('Nenhum log de execucao registrado.')).toBeInTheDocument();
  });

  it('should render Executar Agora button', () => {
    mockUseEmailLogs.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    renderWithQuery(<EmailLogPage />);
    expect(screen.getByText('Executar Agora')).toBeInTheDocument();
  });

  it('should render limit selector', () => {
    mockUseEmailLogs.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    renderWithQuery(<EmailLogPage />);
    expect(screen.getByDisplayValue('20 registros')).toBeInTheDocument();
  });
});
