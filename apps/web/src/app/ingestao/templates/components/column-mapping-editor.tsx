'use client';

import type { ColumnMapping } from '@/types/ingestion';

const TARGET_FIELDS = [
  { value: 'codigo', label: 'Código SKU' },
  { value: 'dataReferencia', label: 'Data Referência' },
  { value: 'volume', label: 'Volume' },
  { value: 'receita', label: 'Receita' },
  { value: 'granularidade', label: 'Granularidade' },
  { value: 'fonte', label: 'Fonte' },
  { value: 'qualidade', label: 'Qualidade' },
] as const;

const DATA_TYPES = [
  { value: 'string', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'boolean', label: 'Booleano' },
] as const;

interface ColumnMappingEditorProps {
  readonly value: readonly ColumnMapping[];
  readonly onChange: (mappings: ColumnMapping[]) => void;
}

function createEmptyMapping(): ColumnMapping {
  return {
    sourceColumn: '',
    targetField: '',
    dataType: 'string',
    transformation: undefined,
    required: false,
  };
}

export function ColumnMappingEditor({
  value,
  onChange,
}: ColumnMappingEditorProps) {
  const addMapping = () => {
    onChange([...value, createEmptyMapping()]);
  };

  const removeMapping = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, field: keyof ColumnMapping, val: unknown) => {
    onChange(
      value.map((m, i) => (i === index ? { ...m, [field]: val } : m)),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Mapeamento de Colunas</h4>
        <button
          type="button"
          onClick={addMapping}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
        >
          + Adicionar Coluna
        </button>
      </div>

      {value.length === 0 && (
        <p className="text-sm text-gray-400">
          Nenhum mapeamento configurado. Adicione colunas acima.
        </p>
      )}

      <div className="space-y-2">
        {value.map((mapping, index) => (
          <div
            key={`${index}-${mapping.sourceColumn}-${mapping.targetField}`}
            className="flex items-center gap-2 rounded border bg-gray-50 p-2"
          >
            <input
              type="text"
              placeholder="Coluna origem"
              value={mapping.sourceColumn}
              onChange={(e) => updateMapping(index, 'sourceColumn', e.target.value)}
              className="w-36 rounded border px-2 py-1 text-sm"
            />

            <span className="text-gray-400">&rarr;</span>

            <select
              value={mapping.targetField}
              onChange={(e) => updateMapping(index, 'targetField', e.target.value)}
              className="w-40 rounded border px-2 py-1 text-sm"
            >
              <option value="">Campo destino</option>
              {TARGET_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            <select
              value={mapping.dataType}
              onChange={(e) => updateMapping(index, 'dataType', e.target.value)}
              className="w-28 rounded border px-2 py-1 text-sm"
            >
              {DATA_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Transformação"
              value={mapping.transformation ?? ''}
              onChange={(e) =>
                updateMapping(index, 'transformation', e.target.value || undefined)
              }
              className="w-32 rounded border px-2 py-1 text-sm"
            />

            <label className="flex items-center gap-1 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={mapping.required}
                onChange={(e) => updateMapping(index, 'required', e.target.checked)}
              />
              Obrig.
            </label>

            <button
              type="button"
              onClick={() => removeMapping(index)}
              className="ml-auto text-red-500 hover:text-red-700"
              aria-label="Remover coluna"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
