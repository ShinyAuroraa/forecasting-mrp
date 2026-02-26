/**
 * @jest-environment jsdom
 *
 * Render tests for Ingestion Template Management components.
 *
 * @see Story 4.1 — Ingestion Mapping Templates (AC-16)
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock hooks
const mockUseIngestionTemplates = jest.fn(() => ({
  data: null,
  isLoading: false,
  isError: false,
}));
const mockUseCreateTemplate = jest.fn(() => ({
  mutate: jest.fn(),
  isPending: false,
}));
const mockUseUpdateTemplate = jest.fn(() => ({
  mutate: jest.fn(),
  isPending: false,
}));
const mockUseDeleteTemplate = jest.fn(() => ({
  mutate: jest.fn(),
  isPending: false,
}));
const mockUseDuplicateTemplate = jest.fn(() => ({
  mutate: jest.fn(),
  isPending: false,
}));

jest.mock('@/hooks/use-ingestion-templates', () => ({
  useIngestionTemplates: (...args: unknown[]) => mockUseIngestionTemplates(...args),
  useCreateTemplate: () => mockUseCreateTemplate(),
  useUpdateTemplate: () => mockUseUpdateTemplate(),
  useDeleteTemplate: () => mockUseDeleteTemplate(),
  useDuplicateTemplate: () => mockUseDuplicateTemplate(),
}));

import IngestionTemplatesPage from '../templates/page';
import { TemplateList } from '../templates/components/template-list';
import { ColumnMappingEditor } from '../templates/components/column-mapping-editor';

describe('IngestionTemplatesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page title', () => {
    render(<IngestionTemplatesPage />);
    expect(screen.getByText('Templates de Mapeamento')).toBeInTheDocument();
  });

  it('renders "Novo Template" button', () => {
    render(<IngestionTemplatesPage />);
    expect(screen.getByText('+ Novo Template')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockUseIngestionTemplates.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
    });
    render(<IngestionTemplatesPage />);
    expect(screen.getByText('Carregando templates...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockUseIngestionTemplates.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
    });
    render(<IngestionTemplatesPage />);
    expect(
      screen.getByText('Erro ao carregar templates. Tente novamente.'),
    ).toBeInTheDocument();
  });

  it('shows empty state when no templates', () => {
    mockUseIngestionTemplates.mockReturnValue({
      data: { data: [], meta: { total: 0 } },
      isLoading: false,
      isError: false,
    });
    render(<IngestionTemplatesPage />);
    expect(
      screen.getByText(/Nenhum template encontrado/),
    ).toBeInTheDocument();
  });

  it('shows form when "Novo Template" clicked', () => {
    mockUseIngestionTemplates.mockReturnValue({
      data: { data: [], meta: { total: 0 } },
      isLoading: false,
      isError: false,
    });
    render(<IngestionTemplatesPage />);
    fireEvent.click(screen.getByText('+ Novo Template'));
    expect(
      screen.getByText('Novo Template de Mapeamento'),
    ).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<IngestionTemplatesPage />);
    expect(
      screen.getByPlaceholderText('Buscar templates...'),
    ).toBeInTheDocument();
  });
});

describe('TemplateList', () => {
  const mockTemplates = [
    {
      id: 'tpl-1',
      nome: 'Vendas SAP',
      descricao: 'Template para SAP',
      tipoFonte: 'CSV' as const,
      colunas: [
        { sourceColumn: 'sku', targetField: 'codigo', dataType: 'string' as const, required: true },
      ],
      validationRules: null,
      lastUsedAt: '2026-02-27T00:00:00Z',
      usageCount: 5,
      ativo: true,
      createdAt: '2026-02-27T00:00:00Z',
      updatedAt: '2026-02-27T00:00:00Z',
    },
  ];

  it('renders template rows', () => {
    render(
      <TemplateList
        templates={mockTemplates}
        onEdit={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.getByText('Vendas SAP')).toBeInTheDocument();
    expect(screen.getByText('Template para SAP')).toBeInTheDocument();
    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('calls onEdit when Edit clicked', () => {
    const onEdit = jest.fn();
    render(
      <TemplateList
        templates={mockTemplates}
        onEdit={onEdit}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Editar'));
    expect(onEdit).toHaveBeenCalledWith(mockTemplates[0]);
  });

  it('calls onDuplicate when Duplicar clicked', () => {
    const onDuplicate = jest.fn();
    render(
      <TemplateList
        templates={mockTemplates}
        onEdit={jest.fn()}
        onDuplicate={onDuplicate}
        onDelete={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Duplicar'));
    expect(onDuplicate).toHaveBeenCalledWith('tpl-1');
  });

  it('renders empty state when no templates', () => {
    render(
      <TemplateList
        templates={[]}
        onEdit={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.getByText(/Nenhum template encontrado/)).toBeInTheDocument();
  });
});

describe('ColumnMappingEditor', () => {
  it('renders existing mappings', () => {
    const mappings = [
      { sourceColumn: 'sku', targetField: 'codigo', dataType: 'string' as const, required: true },
    ];
    render(<ColumnMappingEditor value={mappings} onChange={jest.fn()} />);
    expect(screen.getByDisplayValue('sku')).toBeInTheDocument();
  });

  it('shows empty state when no mappings', () => {
    render(<ColumnMappingEditor value={[]} onChange={jest.fn()} />);
    expect(
      screen.getByText(/Nenhum mapeamento configurado/),
    ).toBeInTheDocument();
  });

  it('adds a mapping when button clicked', () => {
    const onChange = jest.fn();
    render(<ColumnMappingEditor value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Adicionar Coluna'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ sourceColumn: '', targetField: '' }),
      ]),
    );
  });
});
