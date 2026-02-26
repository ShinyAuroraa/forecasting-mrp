/**
 * @jest-environment jsdom
 *
 * Basic render tests for UrgentActionsTable.
 *
 * Prerequisites (devDependencies):
 *   @testing-library/react, @testing-library/jest-dom, jest, jest-environment-jsdom
 *
 * @see Story 3.11 — Purchasing Panel (AC-17)
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { UrgentActionsTable } from '../urgent-actions-table';
import type { UrgentAction } from '@/types/purchasing';

const mockActions: UrgentAction[] = [
  {
    orderId: 'order-1',
    produtoCodigo: 'SKU-001',
    produtoDescricao: 'Material Premium',
    quantidade: 250,
    fornecedorNome: 'Fornecedor ABC',
    fornecedorId: 'forn-1',
    dataLiberacao: '2026-02-28',
    dataNecessidade: '2026-03-05',
    custoEstimado: 12500,
    prioridade: 'CRITICA',
    mensagemAcao: null,
  },
  {
    orderId: 'order-2',
    produtoCodigo: 'SKU-002',
    produtoDescricao: 'Insumo Basico',
    quantidade: 500,
    fornecedorNome: 'Fornecedor XYZ',
    fornecedorId: 'forn-2',
    dataLiberacao: '2026-03-01',
    dataNecessidade: '2026-03-08',
    custoEstimado: 8000,
    prioridade: 'ALTA',
    mensagemAcao: 'LIBERAR',
  },
];

describe('UrgentActionsTable', () => {
  it('should render the table with correct title and count', () => {
    render(<UrgentActionsTable actions={mockActions} />);

    expect(screen.getByText(/Ações Urgentes/)).toBeInTheDocument();
    expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
  });

  it('should render all action rows', () => {
    render(<UrgentActionsTable actions={mockActions} />);

    expect(screen.getByText('SKU-001')).toBeInTheDocument();
    expect(screen.getByText('SKU-002')).toBeInTheDocument();
    expect(screen.getByText('Fornecedor ABC')).toBeInTheDocument();
    expect(screen.getByText('Fornecedor XYZ')).toBeInTheDocument();
  });

  it('should render priority badges', () => {
    render(<UrgentActionsTable actions={mockActions} />);

    expect(screen.getByText('Crítica')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
  });

  it('should render formatted dates (dd/MM/yyyy)', () => {
    render(<UrgentActionsTable actions={mockActions} />);

    expect(screen.getByText('28/02/2026')).toBeInTheDocument();
    expect(screen.getByText('01/03/2026')).toBeInTheDocument();
  });

  it('should show empty state when no actions', () => {
    render(<UrgentActionsTable actions={[]} />);

    expect(
      screen.getByText(/Nenhuma ação urgente encontrada/),
    ).toBeInTheDocument();
  });

  it('should filter actions by search term', () => {
    render(<UrgentActionsTable actions={mockActions} />);

    const searchInput = screen.getByPlaceholderText(/Buscar/);
    fireEvent.change(searchInput, { target: { value: 'Premium' } });

    expect(screen.getByText('SKU-001')).toBeInTheDocument();
    expect(screen.queryByText('SKU-002')).not.toBeInTheDocument();
  });

  it('should render column headers', () => {
    render(<UrgentActionsTable actions={mockActions} />);

    expect(screen.getByText(/SKU/)).toBeInTheDocument();
    expect(screen.getByText(/Quantidade/)).toBeInTheDocument();
    expect(screen.getByText(/Fornecedor/)).toBeInTheDocument();
    expect(screen.getByText(/Custo Estimado/)).toBeInTheDocument();
    expect(screen.getByText(/Prioridade/)).toBeInTheDocument();
  });
});
