import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Model list mocks ---
const mockModelsData = {
  data: [
    {
      id: 'mod-1',
      modelName: 'TFT',
      version: 3,
      isChampion: true,
      trainingMetrics: { mape: 5.2 },
      trainedAt: '2026-02-26T00:00:00Z',
    },
    {
      id: 'mod-2',
      modelName: 'ETS',
      version: 1,
      isChampion: false,
      trainingMetrics: { mape: 12.5 },
      trainedAt: '2026-02-20T00:00:00Z',
    },
  ],
  meta: { total: 2, page: 1, limit: 50, totalPages: 1, hasNext: false, hasPrev: false },
};

let mockModelsReturn: unknown = { data: mockModelsData, isLoading: false };
let mockHistoryReturn: unknown = { data: [], isLoading: false };

jest.mock('@/hooks/use-forecast', () => ({
  useModels: () => mockModelsReturn,
  useChampionHistory: () => mockHistoryReturn,
}));

import { ModelList } from '../model-list';
import { ChampionHistory } from '../champion-history';

function renderWithQueryClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('ModelList — Champion Badge (AC-12)', () => {
  beforeEach(() => {
    mockModelsReturn = { data: mockModelsData, isLoading: false };
  });

  it('should show Champion badge for champion model', () => {
    renderWithQueryClient(<ModelList />);
    expect(screen.getByText('Champion')).toBeInTheDocument();
  });

  it('should show model names', () => {
    renderWithQueryClient(<ModelList />);
    expect(screen.getByText('TFT')).toBeInTheDocument();
    expect(screen.getByText('ETS')).toBeInTheDocument();
  });

  it('should not show Champion badge for non-champion model', () => {
    renderWithQueryClient(<ModelList />);
    const badges = screen.getAllByText('Champion');
    // Only 1 champion badge (TFT)
    expect(badges).toHaveLength(1);
  });

  it('should show loading state', () => {
    mockModelsReturn = { data: undefined, isLoading: true };
    renderWithQueryClient(<ModelList />);
    expect(screen.getByText('Carregando modelos...')).toBeInTheDocument();
  });
});

describe('ChampionHistory — Promotion Timeline (AC-13)', () => {
  beforeEach(() => {
    mockHistoryReturn = { data: [], isLoading: false };
  });

  it('should show title', () => {
    renderWithQueryClient(<ChampionHistory />);
    expect(screen.getByText('Histórico de Promoção de Modelos')).toBeInTheDocument();
  });

  it('should show empty state when no history', () => {
    renderWithQueryClient(<ChampionHistory />);
    expect(screen.getByText('Nenhum histórico disponível.')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    mockHistoryReturn = { data: undefined, isLoading: true };
    renderWithQueryClient(<ChampionHistory />);
    expect(screen.getByText('Carregando histórico...')).toBeInTheDocument();
  });

  it('should render promotion entries with champion badge', () => {
    mockHistoryReturn = {
      data: [
        {
          id: 'mod-1',
          tipoModelo: 'TFT',
          versao: 3,
          isChampion: true,
          metricasTreino: {
            avg_mape: 5.2,
            promotion_log: {
              promoted: true,
              new_mape: 5.2,
              champion_mape: 8.0,
              reason: 'New MAPE (5.20%) < Champion (8.00%)',
            },
          },
          treinadoEm: '2026-02-26T00:00:00Z',
          createdAt: '2026-02-26T00:00:00Z',
        },
      ],
      isLoading: false,
    };

    renderWithQueryClient(<ChampionHistory />);
    expect(screen.getByText('TFT')).toBeInTheDocument();
    expect(screen.getByText('Champion')).toBeInTheDocument();
    expect(screen.getByText('MAPE: 5.20%')).toBeInTheDocument();
  });

  it('should show rejected badge for non-promoted models', () => {
    mockHistoryReturn = {
      data: [
        {
          id: 'mod-2',
          tipoModelo: 'ETS',
          versao: 2,
          isChampion: false,
          metricasTreino: {
            avg_mape: 12.0,
            promotion_log: {
              promoted: false,
              new_mape: 12.0,
              champion_mape: 8.0,
              reason: 'New MAPE (12.00%) >= Champion (8.00%)',
            },
          },
          treinadoEm: '2026-02-20T00:00:00Z',
          createdAt: '2026-02-20T00:00:00Z',
        },
      ],
      isLoading: false,
    };

    renderWithQueryClient(<ChampionHistory />);
    expect(screen.getByText('Rejeitado')).toBeInTheDocument();
  });

  it('should show MAPE delta for promotion entries', () => {
    mockHistoryReturn = {
      data: [
        {
          id: 'mod-1',
          tipoModelo: 'TFT',
          versao: 3,
          isChampion: true,
          metricasTreino: {
            avg_mape: 5.2,
            promotion_log: {
              promoted: true,
              new_mape: 5.2,
              champion_mape: 8.0,
              reason: 'Improved',
            },
          },
          treinadoEm: '2026-02-26T00:00:00Z',
          createdAt: '2026-02-26T00:00:00Z',
        },
      ],
      isLoading: false,
    };

    renderWithQueryClient(<ChampionHistory />);
    // Delta should be -2.80% MAPE (5.2 - 8.0)
    expect(screen.getByText('-2.80% MAPE')).toBeInTheDocument();
  });
});
