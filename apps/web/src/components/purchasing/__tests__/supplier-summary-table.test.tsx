/**
 * @jest-environment jsdom
 *
 * Basic render tests for SupplierSummaryTable.
 *
 * Prerequisites (devDependencies):
 *   @testing-library/react, @testing-library/jest-dom, jest, jest-environment-jsdom
 *
 * @see Story 3.11 — Purchasing Panel (AC-17)
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { SupplierSummaryTable } from '../supplier-summary-table';
import type { SupplierSummary } from '@/types/purchasing';

const mockSuppliers: SupplierSummary[] = [
  {
    fornecedorId: 'forn-1',
    fornecedorNome: 'Fornecedor Alpha',
    totalOrders: 5,
    totalQuantidade: 1000,
    totalCusto: 50000,
    orders: [
      {
        orderId: 'order-a1',
        produtoCodigo: 'SKU-100',
        produtoDescricao: 'Produto A1',
        quantidade: 200,
        custoEstimado: 10000,
        dataLiberacao: '2026-03-01',
        prioridade: 'ALTA',
      },
      {
        orderId: 'order-a2',
        produtoCodigo: 'SKU-101',
        produtoDescricao: 'Produto A2',
        quantidade: 300,
        custoEstimado: 15000,
        dataLiberacao: '2026-03-03',
        prioridade: 'MEDIA',
      },
    ],
  },
  {
    fornecedorId: 'forn-2',
    fornecedorNome: 'Fornecedor Beta',
    totalOrders: 3,
    totalQuantidade: 600,
    totalCusto: 30000,
    orders: [
      {
        orderId: 'order-b1',
        produtoCodigo: 'SKU-200',
        produtoDescricao: 'Produto B1',
        quantidade: 600,
        custoEstimado: 30000,
        dataLiberacao: '2026-03-02',
        prioridade: 'CRITICA',
      },
    ],
  },
];

describe('SupplierSummaryTable', () => {
  it('should render the table with supplier count', () => {
    render(<SupplierSummaryTable suppliers={mockSuppliers} />);

    expect(screen.getByText(/Resumo por Fornecedor/)).toBeInTheDocument();
    expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
  });

  it('should render all supplier rows', () => {
    render(<SupplierSummaryTable suppliers={mockSuppliers} />);

    expect(screen.getByText('Fornecedor Alpha')).toBeInTheDocument();
    expect(screen.getByText('Fornecedor Beta')).toBeInTheDocument();
  });

  it('should show empty state when no suppliers', () => {
    render(<SupplierSummaryTable suppliers={[]} />);

    expect(
      screen.getByText(/Nenhum fornecedor encontrado/),
    ).toBeInTheDocument();
  });

  it('should expand a supplier row when clicked to show orders', () => {
    render(<SupplierSummaryTable suppliers={mockSuppliers} />);

    // Click on "Fornecedor Alpha" row to expand
    const alphaRow = screen.getByText('Fornecedor Alpha');
    fireEvent.click(alphaRow);

    // Should now show individual order details
    expect(screen.getByText('SKU-100')).toBeInTheDocument();
    expect(screen.getByText('Produto A1')).toBeInTheDocument();
    expect(screen.getByText('SKU-101')).toBeInTheDocument();
  });

  it('should collapse an expanded row when clicked again', () => {
    render(<SupplierSummaryTable suppliers={mockSuppliers} />);

    const alphaRow = screen.getByText('Fornecedor Alpha');

    // Expand
    fireEvent.click(alphaRow);
    expect(screen.getByText('SKU-100')).toBeInTheDocument();

    // Collapse
    fireEvent.click(alphaRow);
    expect(screen.queryByText('Produto A1')).not.toBeInTheDocument();
  });

  it('should filter suppliers by search term', () => {
    render(<SupplierSummaryTable suppliers={mockSuppliers} />);

    const searchInput = screen.getByPlaceholderText(/Buscar fornecedor/);
    fireEvent.change(searchInput, { target: { value: 'Beta' } });

    expect(screen.getByText('Fornecedor Beta')).toBeInTheDocument();
    expect(screen.queryByText('Fornecedor Alpha')).not.toBeInTheDocument();
  });

  it('should render column headers', () => {
    render(<SupplierSummaryTable suppliers={mockSuppliers} />);

    expect(screen.getByText(/Fornecedor/)).toBeInTheDocument();
    expect(screen.getByText(/Total Ordens/)).toBeInTheDocument();
    expect(screen.getByText(/Total Quantidade/)).toBeInTheDocument();
    expect(screen.getByText(/Total Custo/)).toBeInTheDocument();
  });
});
