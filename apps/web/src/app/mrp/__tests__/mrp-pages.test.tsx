/**
 * @jest-environment jsdom
 *
 * Render tests for MRP Dashboard components.
 *
 * Tests verify that components render correctly with mock data.
 * ECharts is mocked since it requires a DOM canvas.
 *
 * @see Story 3.12 — MRP & Capacity Dashboards (AC-20)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock echarts-for-react (SSR dynamic import)
jest.mock('echarts-for-react', () => {
  return function MockECharts(props: { option: unknown }) {
    return <div data-testid="echarts-mock">{JSON.stringify(props.option).slice(0, 50)}</div>;
  };
});

// Mock next/dynamic to return component directly
jest.mock('next/dynamic', () => {
  return function mockDynamic(loader: () => Promise<unknown>) {
    const Module = require('echarts-for-react');
    return Module;
  };
});

// Mock hooks
jest.mock('@/hooks/use-mrp', () => ({
  useMrpOrders: jest.fn(() => ({ data: null, isLoading: false })),
  useMrpCapacity: jest.fn(() => ({ data: null, isLoading: false })),
  useMrpStockParams: jest.fn(() => ({ data: null, isLoading: false })),
  useMrpStorage: jest.fn(() => ({ data: null, isLoading: false })),
}));

jest.mock('@/hooks/use-purchasing', () => ({
  useMrpExecutions: jest.fn(() => ({
    data: {
      data: [
        { id: 'exec-1', tipo: 'MRP', status: 'CONCLUIDO', gatilho: 'MANUAL', createdAt: '2026-02-26T10:00:00Z' },
      ],
    },
    isLoading: false,
  })),
}));

import { GanttChart } from '../components/gantt-chart';
import { MrpGridTable } from '../detail/components/mrp-grid-table';
import { StockProjectionChart } from '../stock/components/stock-projection-chart';
import { OverloadAlerts } from '../capacity/components/overload-alerts';
import { SkuSelector } from '@/components/mrp/sku-selector';
import { ExecutionSelector } from '@/components/purchasing/execution-selector';
import type { PlannedOrder, CapacityWeekRecord, StockParams } from '@/types/mrp';

// ─── Mock Data ─────────────────────────────────────────

const mockOrders: PlannedOrder[] = [
  {
    id: 'ord-1',
    execucaoId: 'exec-1',
    produtoId: 'prod-1',
    tipo: 'COMPRA',
    quantidade: 100,
    dataNecessidade: '2026-03-10T00:00:00Z',
    dataLiberacao: '2026-03-03T00:00:00Z',
    dataRecebimentoEsperado: '2026-03-10T00:00:00Z',
    fornecedorId: 'forn-1',
    centroTrabalhoId: null,
    custoEstimado: 5000,
    lotificacaoUsada: 'EOQ',
    prioridade: 'ALTA',
    status: 'PLANEJADA',
    produto: { codigo: 'SKU-001', descricao: 'Matéria Prima A' },
    fornecedor: { razaoSocial: 'Fornecedor Alpha' },
    centroTrabalho: null,
  },
  {
    id: 'ord-2',
    execucaoId: 'exec-1',
    produtoId: 'prod-2',
    tipo: 'PRODUCAO',
    quantidade: 50,
    dataNecessidade: '2026-03-12T00:00:00Z',
    dataLiberacao: '2026-03-05T00:00:00Z',
    dataRecebimentoEsperado: '2026-03-12T00:00:00Z',
    fornecedorId: null,
    centroTrabalhoId: 'wc-1',
    custoEstimado: 3000,
    lotificacaoUsada: 'LFL',
    prioridade: 'MEDIA',
    status: 'PLANEJADA',
    produto: { codigo: 'SKU-002', descricao: 'Produto Acabado B' },
    fornecedor: null,
    centroTrabalho: { codigo: 'CT-01', nome: 'Linha 1' },
  },
];

const mockCapacityRecords: CapacityWeekRecord[] = [
  {
    id: 'cap-1',
    execucaoId: 'exec-1',
    centroTrabalhoId: 'wc-1',
    periodStart: '2026-03-02T00:00:00Z',
    capacidadeDisponivelHoras: 40,
    cargaPlanejadaHoras: 48,
    utilizacaoPercentual: 120,
    sobrecarga: true,
    horasExcedentes: 8,
    sugestao: 'HORA_EXTRA',
    centroTrabalho: { codigo: 'CT-01', nome: 'Linha 1' },
  },
  {
    id: 'cap-2',
    execucaoId: 'exec-1',
    centroTrabalhoId: 'wc-1',
    periodStart: '2026-03-09T00:00:00Z',
    capacidadeDisponivelHoras: 40,
    cargaPlanejadaHoras: 35,
    utilizacaoPercentual: 87.5,
    sobrecarga: false,
    horasExcedentes: 0,
    sugestao: 'OK',
    centroTrabalho: { codigo: 'CT-01', nome: 'Linha 1' },
  },
];

const mockStockParams: StockParams = {
  id: 'sp-1',
  execucaoId: 'exec-1',
  produtoId: 'prod-1',
  safetyStock: 50,
  reorderPoint: 100,
  estoqueMinimo: 30,
  estoqueMaximo: 500,
  eoq: 200,
  metodoCalculo: 'FORMULA_CLASSICA',
  nivelServicoUsado: 0.95,
  calculatedAt: '2026-02-26T10:00:00Z',
};

// ─── Tests ─────────────────────────────────────────────

describe('Story 3.12 — MRP & Capacity Dashboards', () => {
  describe('GanttChart', () => {
    it('renders Gantt chart with order count', () => {
      render(<GanttChart orders={mockOrders} />);
      expect(screen.getByText(/Gantt — Ordens Planejadas/)).toBeInTheDocument();
      expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
    });

    it('renders chart container with echarts', () => {
      render(<GanttChart orders={mockOrders} />);
      expect(screen.getByTestId('echarts-mock')).toBeInTheDocument();
    });

    it('renders legend items for Compra and Produção', () => {
      render(<GanttChart orders={mockOrders} />);
      expect(screen.getByText('Compra')).toBeInTheDocument();
      expect(screen.getByText('Produção')).toBeInTheDocument();
    });

    it('renders empty state when no orders', () => {
      render(<GanttChart orders={[]} />);
      expect(screen.getByText(/\(0\)/)).toBeInTheDocument();
    });
  });

  describe('MrpGridTable', () => {
    it('renders grid table with period columns', () => {
      render(
        <MrpGridTable
          orders={mockOrders}
          stockParams={mockStockParams}
          produtoId="prod-1"
        />,
      );
      expect(screen.getByText('Necessidade Bruta')).toBeInTheDocument();
      expect(screen.getByText('Recebimentos Programados')).toBeInTheDocument();
      expect(screen.getByText('Estoque Projetado')).toBeInTheDocument();
      expect(screen.getByText('Necessidade Líquida')).toBeInTheDocument();
      expect(screen.getByText('Ordens Planejadas')).toBeInTheDocument();
    });

    it('renders grid title with period count', () => {
      render(
        <MrpGridTable
          orders={mockOrders}
          stockParams={mockStockParams}
          produtoId="prod-1"
        />,
      );
      expect(screen.getByText(/Grade MRP/)).toBeInTheDocument();
    });

    it('renders empty state for non-matching product', () => {
      render(
        <MrpGridTable
          orders={mockOrders}
          stockParams={null}
          produtoId="prod-nonexistent"
        />,
      );
      expect(screen.getByText(/Nenhum dado MRP/)).toBeInTheDocument();
    });
  });

  describe('StockProjectionChart', () => {
    it('renders stock projection chart', () => {
      render(
        <StockProjectionChart
          orders={mockOrders}
          stockParams={mockStockParams}
          produtoId="prod-1"
        />,
      );
      expect(screen.getByText('Projeção de Estoque')).toBeInTheDocument();
    });

    it('renders echarts container', () => {
      render(
        <StockProjectionChart
          orders={mockOrders}
          stockParams={mockStockParams}
          produtoId="prod-1"
        />,
      );
      expect(screen.getByTestId('echarts-mock')).toBeInTheDocument();
    });
  });

  describe('OverloadAlerts', () => {
    it('renders overload alerts table', () => {
      render(<OverloadAlerts records={mockCapacityRecords} />);
      expect(screen.getByText(/Alertas de Sobrecarga/)).toBeInTheDocument();
    });

    it('shows correct count of overloaded work centers', () => {
      render(<OverloadAlerts records={mockCapacityRecords} />);
      // Only 1 record has sobrecarga=true
      expect(screen.getByText('(1)')).toBeInTheDocument();
    });

    it('shows overloaded work center name and utilization', () => {
      render(<OverloadAlerts records={mockCapacityRecords} />);
      expect(screen.getByText('Linha 1')).toBeInTheDocument();
      expect(screen.getByText('120.0%')).toBeInTheDocument();
    });

    it('shows suggestion badge', () => {
      render(<OverloadAlerts records={mockCapacityRecords} />);
      expect(screen.getByText('Hora Extra')).toBeInTheDocument();
    });

    it('renders empty state when no overloads', () => {
      const noOverloadRecords = mockCapacityRecords.map((r) => ({
        ...r,
        sobrecarga: false,
      }));
      render(<OverloadAlerts records={noOverloadRecords} />);
      expect(screen.getByText(/Nenhuma sobrecarga detectada/)).toBeInTheDocument();
    });
  });

  describe('SkuSelector', () => {
    it('renders SKU selector dropdown', () => {
      render(
        <SkuSelector
          orders={mockOrders}
          selectedProdutoId={null}
          onSelect={jest.fn()}
        />,
      );
      expect(screen.getByText('SKU:')).toBeInTheDocument();
      expect(screen.getByText('Selecione um SKU')).toBeInTheDocument();
    });

    it('populates options from orders', () => {
      render(
        <SkuSelector
          orders={mockOrders}
          selectedProdutoId={null}
          onSelect={jest.fn()}
        />,
      );
      expect(screen.getByText(/SKU-001/)).toBeInTheDocument();
      expect(screen.getByText(/SKU-002/)).toBeInTheDocument();
    });

    it('renders empty state with no orders', () => {
      render(
        <SkuSelector
          orders={[]}
          selectedProdutoId={null}
          onSelect={jest.fn()}
        />,
      );
      expect(screen.getByText('Nenhum SKU encontrado')).toBeInTheDocument();
    });
  });

  describe('ExecutionSelector', () => {
    it('renders execution selector dropdown', () => {
      render(
        <ExecutionSelector selectedId={null} onSelect={jest.fn()} />,
      );
      expect(screen.getByText('Execução MRP:')).toBeInTheDocument();
    });
  });
});
