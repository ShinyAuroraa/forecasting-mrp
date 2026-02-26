'use client';

import { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TemplateList } from './components/template-list';
import { TemplateForm } from './components/template-form';
import {
  useIngestionTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useDuplicateTemplate,
} from '@/hooks/use-ingestion-templates';
import type { MappingTemplate, ColumnMapping, TipoFonte } from '@/types/ingestion';

type ViewMode = 'list' | 'create' | 'edit';

/**
 * Ingestion Mapping Templates page — /ingestao/templates
 *
 * CRUD management for column mapping templates used in data ingestion.
 *
 * @see Story 4.1 — Ingestion Mapping Templates (AC-13, AC-14)
 */
export default function IngestionTemplatesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingTemplate, setEditingTemplate] = useState<MappingTemplate | null>(null);
  const [search, setSearch] = useState('');

  const { data: templatesData, isLoading, isError } = useIngestionTemplates(
    search || undefined,
  );
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();
  const duplicateMutation = useDuplicateTemplate();

  const handleCreate = useCallback(
    (data: {
      nome: string;
      descricao?: string;
      tipoFonte: TipoFonte;
      colunas: ColumnMapping[];
    }) => {
      createMutation.mutate(data, {
        onSuccess: () => setViewMode('list'),
      });
    },
    [createMutation],
  );

  const handleUpdate = useCallback(
    (data: {
      nome: string;
      descricao?: string;
      tipoFonte: TipoFonte;
      colunas: ColumnMapping[];
    }) => {
      if (!editingTemplate) return;
      updateMutation.mutate(
        { id: editingTemplate.id, data },
        {
          onSuccess: () => {
            setViewMode('list');
            setEditingTemplate(null);
          },
        },
      );
    },
    [editingTemplate, updateMutation],
  );

  const handleEdit = useCallback((template: MappingTemplate) => {
    setEditingTemplate(template);
    setViewMode('edit');
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      if (window.confirm('Deseja realmente excluir este template?')) {
        deleteMutation.mutate(id);
      }
    },
    [deleteMutation],
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      duplicateMutation.mutate(id);
    },
    [duplicateMutation],
  );

  const handleCancel = useCallback(() => {
    setViewMode('list');
    setEditingTemplate(null);
  }, []);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Templates de Mapeamento</h1>
        {viewMode === 'list' && (
          <button
            onClick={() => setViewMode('create')}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            + Novo Template
          </button>
        )}
      </div>

      {viewMode === 'list' && (
        <>
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Buscar templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 rounded border px-3 py-2 text-sm"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Templates Disponíveis</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading && (
                <p className="text-sm text-gray-500">Carregando templates...</p>
              )}

              {isError && (
                <p className="text-sm text-red-500">
                  Erro ao carregar templates. Tente novamente.
                </p>
              )}

              {templatesData && (
                <TemplateList
                  templates={templatesData.data}
                  onEdit={handleEdit}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {viewMode === 'create' && (
        <TemplateForm
          onSubmit={handleCreate}
          onCancel={handleCancel}
          isLoading={createMutation.isPending}
        />
      )}

      {viewMode === 'edit' && editingTemplate && (
        <TemplateForm
          initialData={editingTemplate}
          onSubmit={handleUpdate}
          onCancel={handleCancel}
          isLoading={updateMutation.isPending}
        />
      )}
    </main>
  );
}
