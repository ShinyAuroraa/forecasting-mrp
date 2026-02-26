import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Override mocks ---
let mockOverridesReturn: unknown = { data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false } }, isLoading: false };
let mockCreateReturn: unknown = { mutate: jest.fn(), isPending: false, error: null };
let mockRevertReturn: unknown = { mutate: jest.fn(), isPending: false, error: null };

jest.mock('@/hooks/use-overrides', () => ({
  useOverrides: () => mockOverridesReturn,
  useCreateOverride: () => mockCreateReturn,
  useRevertOverride: () => mockRevertReturn,
}));

import { OverrideHistory } from '../override-history';
import { OverrideForm } from '../override-form';

function renderWithQueryClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('OverrideHistory — AC-13', () => {
  beforeEach(() => {
    mockOverridesReturn = {
      data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false } },
      isLoading: false,
    };
    mockRevertReturn = { mutate: jest.fn(), isPending: false, error: null };
  });

  it('should show title', () => {
    renderWithQueryClient(<OverrideHistory />);
    expect(screen.getByText('Histórico de Ajustes Manuais')).toBeInTheDocument();
  });

  it('should show empty state', () => {
    renderWithQueryClient(<OverrideHistory />);
    expect(screen.getByText('Nenhum ajuste manual registrado.')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    mockOverridesReturn = { data: undefined, isLoading: true };
    renderWithQueryClient(<OverrideHistory />);
    expect(screen.getByText('Carregando histórico de overrides...')).toBeInTheDocument();
  });

  it('should render override entries', () => {
    mockOverridesReturn = {
      data: {
        data: [
          {
            id: 'o-1',
            forecastResultadoId: 'fr-1',
            produtoId: 'prod-1',
            periodo: '2026-03-01',
            originalP50: 100.0,
            overrideP50: 120.0,
            motivo: 'Promoção de verão',
            categoriaOverride: 'PROMOTION',
            revertedFromId: null,
            createdBy: 'user-1',
            createdAt: '2026-02-28T10:00:00Z',
            produto: { id: 'prod-1', codigo: 'SKU-001', descricao: 'Produto A' },
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false },
      },
      isLoading: false,
    };

    renderWithQueryClient(<OverrideHistory />);
    expect(screen.getByText('SKU-001')).toBeInTheDocument();
    expect(screen.getByText('Promoção')).toBeInTheDocument();
    expect(screen.getByText('Promoção de verão')).toBeInTheDocument();
    expect(screen.getByText('120.00')).toBeInTheDocument();
  });

  it('should show revert button for non-revert entries', () => {
    mockOverridesReturn = {
      data: {
        data: [
          {
            id: 'o-1',
            produtoId: 'prod-1',
            periodo: '2026-03-01',
            originalP50: 100.0,
            overrideP50: 120.0,
            motivo: 'Test',
            categoriaOverride: 'OTHER',
            revertedFromId: null,
            createdBy: null,
            createdAt: '2026-02-28T10:00:00Z',
            produto: { id: 'prod-1', codigo: 'SKU-001', descricao: 'Produto A' },
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false },
      },
      isLoading: false,
    };

    renderWithQueryClient(<OverrideHistory />);
    expect(screen.getByText('Reverter')).toBeInTheDocument();
  });

  it('should not show revert button for revert entries', () => {
    mockOverridesReturn = {
      data: {
        data: [
          {
            id: 'o-2',
            produtoId: 'prod-1',
            periodo: '2026-03-01',
            originalP50: 120.0,
            overrideP50: 100.0,
            motivo: 'REVERT: Reversão',
            categoriaOverride: 'OTHER',
            revertedFromId: 'o-1',
            createdBy: null,
            createdAt: '2026-02-28T11:00:00Z',
            produto: { id: 'prod-1', codigo: 'SKU-001', descricao: 'Produto A' },
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false },
      },
      isLoading: false,
    };

    renderWithQueryClient(<OverrideHistory />);
    expect(screen.getByText('Reversão')).toBeInTheDocument();
    expect(screen.queryByText('Reverter')).not.toBeInTheDocument();
  });

  it('should show delta value', () => {
    mockOverridesReturn = {
      data: {
        data: [
          {
            id: 'o-1',
            produtoId: 'prod-1',
            periodo: '2026-03-01',
            originalP50: 100.0,
            overrideP50: 120.0,
            motivo: 'Test',
            categoriaOverride: 'SEASONAL',
            revertedFromId: null,
            createdBy: null,
            createdAt: '2026-02-28T10:00:00Z',
            produto: { id: 'prod-1', codigo: 'SKU-001', descricao: 'Produto A' },
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false },
      },
      isLoading: false,
    };

    renderWithQueryClient(<OverrideHistory />);
    expect(screen.getByText('+20.00')).toBeInTheDocument();
  });

  it('should show category badge with correct label', () => {
    mockOverridesReturn = {
      data: {
        data: [
          {
            id: 'o-1',
            produtoId: 'prod-1',
            periodo: '2026-03-01',
            originalP50: null,
            overrideP50: 50.0,
            motivo: 'Inteligência de mercado',
            categoriaOverride: 'MARKET_INTELLIGENCE',
            revertedFromId: null,
            createdBy: null,
            createdAt: '2026-02-28T10:00:00Z',
            produto: { id: 'prod-1', codigo: 'SKU-002', descricao: 'Produto B' },
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false },
      },
      isLoading: false,
    };

    renderWithQueryClient(<OverrideHistory />);
    expect(screen.getByText('Intel. Mercado')).toBeInTheDocument();
  });
});

describe('OverrideForm — AC-12', () => {
  const defaultProps = {
    produtoId: 'prod-1',
    produtoCodigo: 'SKU-001',
    periodo: '2026-03-01',
    originalP50: 100.0,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    mockCreateReturn = { mutate: jest.fn(), isPending: false, error: null };
  });

  it('should show form title with product code', () => {
    renderWithQueryClient(<OverrideForm {...defaultProps} />);
    expect(screen.getByText('Ajuste Manual — SKU-001')).toBeInTheDocument();
  });

  it('should show original value', () => {
    renderWithQueryClient(<OverrideForm {...defaultProps} />);
    expect(screen.getByDisplayValue('100.00')).toBeInTheDocument();
  });

  it('should show submit button', () => {
    renderWithQueryClient(<OverrideForm {...defaultProps} />);
    expect(screen.getByText('Salvar Override')).toBeInTheDocument();
  });

  it('should show cancel button', () => {
    renderWithQueryClient(<OverrideForm {...defaultProps} />);
    const cancelBtn = screen.getByText('Cancelar');
    expect(cancelBtn).toBeInTheDocument();
    fireEvent.click(cancelBtn);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should show error message on failure', () => {
    mockCreateReturn = {
      mutate: jest.fn(),
      isPending: false,
      error: new Error('Validation failed'),
    };
    renderWithQueryClient(<OverrideForm {...defaultProps} />);
    expect(screen.getByText('Erro: Validation failed')).toBeInTheDocument();
  });

  it('should show "Salvando..." when pending', () => {
    mockCreateReturn = { mutate: jest.fn(), isPending: true, error: null };
    renderWithQueryClient(<OverrideForm {...defaultProps} />);
    expect(screen.getByText('Salvando...')).toBeInTheDocument();
  });

  it('should have category selector with all options', () => {
    renderWithQueryClient(<OverrideForm {...defaultProps} />);
    expect(screen.getByText('Sazonalidade')).toBeInTheDocument();
    expect(screen.getByText('Promoção')).toBeInTheDocument();
    expect(screen.getByText('Ruptura de Fornecimento')).toBeInTheDocument();
    expect(screen.getByText('Inteligência de Mercado')).toBeInTheDocument();
    expect(screen.getByText('Outro')).toBeInTheDocument();
  });
});
