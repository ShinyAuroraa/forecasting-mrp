import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Drift monitor mocks ---
let mockDriftReturn: unknown = { data: [], isLoading: false };
let mockTriggerReturn: unknown = {
  mutate: jest.fn(),
  isPending: false,
  error: null,
};

jest.mock('@/hooks/use-drift', () => ({
  useDriftStatus: () => mockDriftReturn,
  useTriggerDriftCheck: () => mockTriggerReturn,
}));

import { DriftMonitor } from '../drift-monitor';

function renderWithQueryClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('DriftMonitor — Drift Badge (AC-11)', () => {
  beforeEach(() => {
    mockDriftReturn = { data: [], isLoading: false };
    mockTriggerReturn = {
      mutate: jest.fn(),
      isPending: false,
      error: null,
    };
  });

  it('should show monitor title', () => {
    renderWithQueryClient(<DriftMonitor />);
    expect(screen.getByText('Monitoramento de Drift')).toBeInTheDocument();
  });

  it('should show empty state when no models monitored', () => {
    renderWithQueryClient(<DriftMonitor />);
    expect(screen.getByText('Nenhum modelo monitorado.')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    mockDriftReturn = { data: undefined, isLoading: true };
    renderWithQueryClient(<DriftMonitor />);
    expect(screen.getByText('Carregando status de drift...')).toBeInTheDocument();
  });

  it('should show STABLE badge as "Estável"', () => {
    mockDriftReturn = {
      data: [
        {
          tipoModelo: 'TFT',
          status: 'STABLE',
          currentMape: 5.2,
          rollingAvgMape: 5.0,
          mapeIncreasePct: 0.04,
          recentMapes: [5.2, 5.0, 5.1, 5.0],
          checkedAt: '2026-02-28T10:00:00Z',
        },
      ],
      isLoading: false,
    };
    renderWithQueryClient(<DriftMonitor />);
    expect(screen.getByText('Estável')).toBeInTheDocument();
    expect(screen.getByText('TFT')).toBeInTheDocument();
  });

  it('should show WARNING badge as "Atenção"', () => {
    mockDriftReturn = {
      data: [
        {
          tipoModelo: 'ETS',
          status: 'WARNING',
          currentMape: 11.0,
          rollingAvgMape: 10.0,
          mapeIncreasePct: 0.10,
          recentMapes: [11.0, 10.0, 10.0, 10.0, 10.0],
          checkedAt: '2026-02-28T10:00:00Z',
        },
      ],
      isLoading: false,
    };
    renderWithQueryClient(<DriftMonitor />);
    expect(screen.getByText('Atenção')).toBeInTheDocument();
  });

  it('should show DRIFTING badge as "Drift"', () => {
    mockDriftReturn = {
      data: [
        {
          tipoModelo: 'ARIMA',
          status: 'DRIFTING',
          currentMape: 12.0,
          rollingAvgMape: 10.0,
          mapeIncreasePct: 0.20,
          recentMapes: [12.0, 10.0, 10.0, 10.0, 10.0],
          checkedAt: '2026-02-28T10:00:00Z',
        },
      ],
      isLoading: false,
    };
    renderWithQueryClient(<DriftMonitor />);
    expect(screen.getByText('Drift')).toBeInTheDocument();
  });

  it('should show MAPE increase percentage for positive drift', () => {
    mockDriftReturn = {
      data: [
        {
          tipoModelo: 'TFT',
          status: 'DRIFTING',
          currentMape: 12.0,
          rollingAvgMape: 10.0,
          mapeIncreasePct: 0.20,
          recentMapes: [12.0, 10.0, 10.0, 10.0, 10.0],
          checkedAt: '2026-02-28T10:00:00Z',
        },
      ],
      isLoading: false,
    };
    renderWithQueryClient(<DriftMonitor />);
    expect(screen.getByText('+20.0%')).toBeInTheDocument();
  });

  it('should display current MAPE and rolling average', () => {
    mockDriftReturn = {
      data: [
        {
          tipoModelo: 'TFT',
          status: 'STABLE',
          currentMape: 5.25,
          rollingAvgMape: 5.0,
          mapeIncreasePct: 0.05,
          recentMapes: [5.25, 5.0, 5.0, 5.0],
          checkedAt: '2026-02-28T10:00:00Z',
        },
      ],
      isLoading: false,
    };
    renderWithQueryClient(<DriftMonitor />);
    expect(screen.getByText('MAPE: 5.25%')).toBeInTheDocument();
    expect(screen.getByText('Média: 5.00%')).toBeInTheDocument();
  });
});

describe('DriftMonitor — MAPE Sparkline (AC-12)', () => {
  beforeEach(() => {
    mockTriggerReturn = {
      mutate: jest.fn(),
      isPending: false,
      error: null,
    };
  });

  it('should render SVG sparkline with correct aria-label', () => {
    mockDriftReturn = {
      data: [
        {
          tipoModelo: 'TFT',
          status: 'STABLE',
          currentMape: 5.0,
          rollingAvgMape: 5.0,
          mapeIncreasePct: 0.0,
          recentMapes: [5.0, 4.8, 5.1, 4.9],
          checkedAt: '2026-02-28T10:00:00Z',
        },
      ],
      isLoading: false,
    };
    renderWithQueryClient(<DriftMonitor />);
    // Sparkline reverses the mapes so most recent is on the right
    const svg = screen.getByLabelText(/MAPE trend:/);
    expect(svg).toBeInTheDocument();
    expect(svg.tagName).toBe('svg');
  });

  it('should render polyline inside sparkline', () => {
    mockDriftReturn = {
      data: [
        {
          tipoModelo: 'TFT',
          status: 'STABLE',
          currentMape: 5.0,
          rollingAvgMape: 5.0,
          mapeIncreasePct: 0.0,
          recentMapes: [5.0, 4.8, 5.1, 4.9],
          checkedAt: '2026-02-28T10:00:00Z',
        },
      ],
      isLoading: false,
    };
    const { container } = renderWithQueryClient(<DriftMonitor />);
    const polyline = container.querySelector('polyline');
    expect(polyline).toBeInTheDocument();
    expect(polyline).toHaveAttribute('points');
  });

  it('should render latest-value dot (circle) in sparkline', () => {
    mockDriftReturn = {
      data: [
        {
          tipoModelo: 'TFT',
          status: 'STABLE',
          currentMape: 5.0,
          rollingAvgMape: 5.0,
          mapeIncreasePct: 0.0,
          recentMapes: [5.0, 4.8],
          checkedAt: '2026-02-28T10:00:00Z',
        },
      ],
      isLoading: false,
    };
    const { container } = renderWithQueryClient(<DriftMonitor />);
    const circle = container.querySelector('circle');
    expect(circle).toBeInTheDocument();
    expect(circle).toHaveAttribute('r', '2.5');
  });

  it('should render multiple model cards', () => {
    mockDriftReturn = {
      data: [
        {
          tipoModelo: 'TFT',
          status: 'STABLE',
          currentMape: 5.0,
          rollingAvgMape: 5.0,
          mapeIncreasePct: 0.0,
          recentMapes: [5.0],
          checkedAt: '2026-02-28T10:00:00Z',
        },
        {
          tipoModelo: 'ETS',
          status: 'WARNING',
          currentMape: 11.0,
          rollingAvgMape: 10.0,
          mapeIncreasePct: 0.10,
          recentMapes: [11.0, 10.0],
          checkedAt: '2026-02-28T10:00:00Z',
        },
      ],
      isLoading: false,
    };
    renderWithQueryClient(<DriftMonitor />);
    expect(screen.getByText('TFT')).toBeInTheDocument();
    expect(screen.getByText('ETS')).toBeInTheDocument();
    expect(screen.getByText('Estável')).toBeInTheDocument();
    expect(screen.getByText('Atenção')).toBeInTheDocument();
  });
});

describe('DriftMonitor — Manual Check Button', () => {
  it('should have a "Verificar Drift" button', () => {
    mockDriftReturn = { data: [], isLoading: false };
    mockTriggerReturn = {
      mutate: jest.fn(),
      isPending: false,
      error: null,
    };
    renderWithQueryClient(<DriftMonitor />);
    expect(screen.getByText('Verificar Drift')).toBeInTheDocument();
  });

  it('should call mutate on button click', () => {
    const mockMutate = jest.fn();
    mockDriftReturn = { data: [], isLoading: false };
    mockTriggerReturn = {
      mutate: mockMutate,
      isPending: false,
      error: null,
    };
    renderWithQueryClient(<DriftMonitor />);
    fireEvent.click(screen.getByText('Verificar Drift'));
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it('should show "Verificando..." when pending', () => {
    mockDriftReturn = { data: [], isLoading: false };
    mockTriggerReturn = {
      mutate: jest.fn(),
      isPending: true,
      error: null,
    };
    renderWithQueryClient(<DriftMonitor />);
    expect(screen.getByText('Verificando...')).toBeInTheDocument();
  });

  it('should show error message on failure', () => {
    mockDriftReturn = { data: [], isLoading: false };
    mockTriggerReturn = {
      mutate: jest.fn(),
      isPending: false,
      error: new Error('Network failure'),
    };
    renderWithQueryClient(<DriftMonitor />);
    expect(screen.getByText('Erro na verificação: Network failure')).toBeInTheDocument();
  });
});
