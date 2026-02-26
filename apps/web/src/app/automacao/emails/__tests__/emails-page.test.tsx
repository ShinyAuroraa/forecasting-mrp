import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EmailsPage from '../page';

// Mock hooks
const mockUseEmailConfig = jest.fn();
const mockUseEmailHistory = jest.fn();
const mockUseSendSummary = jest.fn();
const mockUseSendBriefing = jest.fn();
const mockUseUpdateEmailConfig = jest.fn();

jest.mock('@/hooks/use-emails', () => ({
  useEmailConfig: () => mockUseEmailConfig(),
  useEmailHistory: () => mockUseEmailHistory(),
  useSendSummary: () => mockUseSendSummary(),
  useSendBriefing: () => mockUseSendBriefing(),
  useUpdateEmailConfig: () => mockUseUpdateEmailConfig(),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('EmailsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseSendSummary.mockReturnValue({ mutate: jest.fn(), isPending: false, isSuccess: false, isError: false });
    mockUseSendBriefing.mockReturnValue({ mutate: jest.fn(), isPending: false, isSuccess: false, isError: false });
    mockUseUpdateEmailConfig.mockReturnValue({ mutate: jest.fn(), isPending: false, isSuccess: false, isError: false });
  });

  it('should render page title', () => {
    mockUseEmailConfig.mockReturnValue({ data: null, isLoading: true });
    mockUseEmailHistory.mockReturnValue({ data: null, isLoading: true });

    renderWithClient(<EmailsPage />);

    expect(screen.getByText('Emails Automaticos')).toBeInTheDocument();
  });

  it('should show send action buttons', () => {
    mockUseEmailConfig.mockReturnValue({ data: null, isLoading: true });
    mockUseEmailHistory.mockReturnValue({ data: null, isLoading: true });

    renderWithClient(<EmailsPage />);

    expect(screen.getByTestId('send-summary-btn')).toBeInTheDocument();
    expect(screen.getByTestId('send-briefing-btn')).toBeInTheDocument();
  });

  it('should show config loading state', () => {
    mockUseEmailConfig.mockReturnValue({ data: null, isLoading: true });
    mockUseEmailHistory.mockReturnValue({ data: null, isLoading: false });

    renderWithClient(<EmailsPage />);

    expect(screen.getByTestId('config-loading')).toBeInTheDocument();
  });

  it('should display config when loaded', () => {
    mockUseEmailConfig.mockReturnValue({
      data: {
        smtp: { host: 'smtp.test.com', port: 587, secure: false, user: 'user', pass: '********', fromAddress: 'from@test.com', fromName: 'Test' },
        recipients: { summary: ['a@b.com'], briefing: ['c@d.com'], cc: [], bcc: [] },
      },
      isLoading: false,
    });
    mockUseEmailHistory.mockReturnValue({ data: null, isLoading: false });

    renderWithClient(<EmailsPage />);

    expect(screen.getByTestId('config-view')).toBeInTheDocument();
    expect(screen.getByText('smtp.test.com')).toBeInTheDocument();
  });

  it('should show empty history message', () => {
    mockUseEmailConfig.mockReturnValue({ data: null, isLoading: true });
    mockUseEmailHistory.mockReturnValue({ data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false } }, isLoading: false });

    renderWithClient(<EmailsPage />);

    expect(screen.getByTestId('no-email-history')).toBeInTheDocument();
  });

  it('should display history rows when data available', () => {
    mockUseEmailConfig.mockReturnValue({ data: null, isLoading: true });
    mockUseEmailHistory.mockReturnValue({
      data: {
        data: [
          { id: '1', tipo: 'RESUMO_DIARIO', destinatarios: ['a@b.com'], assunto: 'Resumo', statusEnvio: 'ENVIADO', tentativas: 1, ultimoErro: null, enviadoEm: '2026-02-26T10:00:00Z', criadoEm: '2026-02-26T10:00:00Z' },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false },
      },
      isLoading: false,
    });

    renderWithClient(<EmailsPage />);

    expect(screen.getAllByTestId('email-history-row')).toHaveLength(1);
    expect(screen.getByText('Resumo Diario')).toBeInTheDocument();
    expect(screen.getByText('Enviado')).toBeInTheDocument();
  });

  it('should show edit button for config', () => {
    mockUseEmailConfig.mockReturnValue({
      data: {
        smtp: { host: 'smtp.test.com', port: 587, secure: false, user: '', pass: '', fromAddress: 'f', fromName: 'n' },
        recipients: { summary: [], briefing: [], cc: [], bcc: [] },
      },
      isLoading: false,
    });
    mockUseEmailHistory.mockReturnValue({ data: null, isLoading: false });

    renderWithClient(<EmailsPage />);

    expect(screen.getByTestId('edit-config-btn')).toBeInTheDocument();
  });
});
