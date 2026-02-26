import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AlertasPage from '../page';

const mockAlerts = [
  {
    id: 'a1',
    tipo: 'STOCKOUT',
    severidade: 'CRITICAL',
    titulo: 'Ruptura SKU-001',
    mensagem: 'Estoque negativo',
    entityId: 'p1',
    entityType: 'Produto',
    metadata: {},
    acknowledgedAt: null,
    acknowledgedBy: null,
    createdAt: '2026-02-26T10:00:00Z',
  },
  {
    id: 'a2',
    tipo: 'CAPACITY_OVERLOAD',
    severidade: 'HIGH',
    titulo: 'Sobrecarga CT-001',
    mensagem: 'Utilização 125%',
    entityId: 'ct1',
    entityType: 'CentroTrabalho',
    metadata: {},
    acknowledgedAt: '2026-02-26T12:00:00Z',
    acknowledgedBy: 'user-1',
    createdAt: '2026-02-26T09:00:00Z',
  },
];

const mockMutate = jest.fn();

jest.mock('@/hooks/use-notifications', () => ({
  useAlerts: jest.fn(() => ({
    data: { data: mockAlerts, total: 2 },
    isLoading: false,
  })),
  useAcknowledgeAlert: jest.fn(() => ({
    mutate: mockMutate,
    isPending: false,
  })),
}));

function renderWithProvider(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('AlertasPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page title', () => {
    renderWithProvider(<AlertasPage />);
    expect(screen.getByText('Histórico de Alertas')).toBeInTheDocument();
  });

  it('renders alerts table with data', () => {
    renderWithProvider(<AlertasPage />);
    expect(screen.getByTestId('alerts-table')).toBeInTheDocument();
    expect(screen.getAllByTestId('alert-row')).toHaveLength(2);
  });

  it('shows alert titles', () => {
    renderWithProvider(<AlertasPage />);
    expect(screen.getByText('Ruptura SKU-001')).toBeInTheDocument();
    expect(screen.getByText('Sobrecarga CT-001')).toBeInTheDocument();
  });

  it('shows severity badges', () => {
    renderWithProvider(<AlertasPage />);
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
  });

  it('shows status for acknowledged alerts', () => {
    renderWithProvider(<AlertasPage />);
    expect(screen.getByText('Reconhecido')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
  });

  it('renders filter selects', () => {
    renderWithProvider(<AlertasPage />);
    expect(screen.getByLabelText('Filtrar por tipo')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtrar por severidade')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtrar por status')).toBeInTheDocument();
  });

  it('shows acknowledge button only for unacknowledged alerts', () => {
    renderWithProvider(<AlertasPage />);
    const ackButtons = screen.getAllByTestId('ack-button');
    expect(ackButtons).toHaveLength(1);
  });

  it('calls acknowledge mutation on button click', () => {
    renderWithProvider(<AlertasPage />);
    const ackButton = screen.getByTestId('ack-button');
    fireEvent.click(ackButton);
    expect(mockMutate).toHaveBeenCalledWith('a1');
  });

  it('shows empty state when no alerts', () => {
    const { useAlerts } = require('@/hooks/use-notifications');
    useAlerts.mockReturnValue({
      data: { data: [], total: 0 },
      isLoading: false,
    });

    renderWithProvider(<AlertasPage />);
    expect(screen.getByTestId('no-alerts')).toBeInTheDocument();
  });
});
