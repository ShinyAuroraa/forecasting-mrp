'use client';

import { useState, type FormEvent } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ColumnMappingEditor } from './column-mapping-editor';
import type {
  ColumnMapping,
  TipoFonte,
  MappingTemplate,
} from '@/types/ingestion';

const TIPO_FONTE_OPTIONS: readonly { value: TipoFonte; label: string }[] = [
  { value: 'CSV', label: 'CSV' },
  { value: 'XLSX', label: 'Excel (XLSX)' },
  { value: 'API', label: 'API' },
  { value: 'DB', label: 'Banco de Dados' },
];

interface TemplateFormProps {
  readonly initialData?: MappingTemplate | null;
  readonly onSubmit: (data: {
    nome: string;
    descricao?: string;
    tipoFonte: TipoFonte;
    colunas: ColumnMapping[];
  }) => void;
  readonly onCancel: () => void;
  readonly isLoading: boolean;
}

export function TemplateForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
}: TemplateFormProps) {
  const [nome, setNome] = useState(initialData?.nome ?? '');
  const [descricao, setDescricao] = useState(initialData?.descricao ?? '');
  const [tipoFonte, setTipoFonte] = useState<TipoFonte>(
    initialData?.tipoFonte ?? 'CSV',
  );
  const [colunas, setColunas] = useState<ColumnMapping[]>(
    initialData?.colunas ? [...initialData.colunas] : [],
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      nome,
      descricao: descricao || undefined,
      tipoFonte,
      colunas,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {initialData ? 'Editar Template' : 'Novo Template de Mapeamento'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nome
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="Ex: Vendas Diárias SAP"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Tipo Fonte
              </label>
              <select
                value={tipoFonte}
                onChange={(e) => setTipoFonte(e.target.value as TipoFonte)}
                className="w-full rounded border px-3 py-2 text-sm"
              >
                {TIPO_FONTE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Descrição
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="Descrição opcional do template..."
            />
          </div>

          <ColumnMappingEditor value={colunas} onChange={setColunas} />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !nome || colunas.length === 0}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Salvando...' : initialData ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
