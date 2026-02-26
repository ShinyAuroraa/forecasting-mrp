'use client';

import { useState } from 'react';
import { useCreateOverride, type CategoriaOverride } from '@/hooks/use-overrides';

const CATEGORIAS: { value: CategoriaOverride; label: string }[] = [
  { value: 'SEASONAL', label: 'Sazonalidade' },
  { value: 'PROMOTION', label: 'Promoção' },
  { value: 'SUPPLY_DISRUPTION', label: 'Ruptura de Fornecimento' },
  { value: 'MARKET_INTELLIGENCE', label: 'Inteligência de Mercado' },
  { value: 'OTHER', label: 'Outro' },
];

interface OverrideFormProps {
  readonly produtoId: string;
  readonly produtoCodigo: string;
  readonly periodo: string;
  readonly originalP50: number | null;
  readonly onClose: () => void;
  readonly forecastResultadoId?: string;
}

export function OverrideForm({
  produtoId,
  produtoCodigo,
  periodo,
  originalP50,
  onClose,
  forecastResultadoId,
}: OverrideFormProps) {
  const [overrideP50, setOverrideP50] = useState(originalP50 ?? 0);
  const [motivo, setMotivo] = useState('');
  const [categoria, setCategoria] = useState<CategoriaOverride>('OTHER');
  const createOverride = useCreateOverride();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createOverride.mutate(
      {
        forecastResultadoId,
        produtoId,
        periodo,
        originalP50: originalP50 ?? undefined,
        overrideP50,
        motivo,
        categoriaOverride: categoria,
      },
      {
        onSuccess: () => onClose(),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
      >
        <h3 className="mb-4 text-lg font-semibold">
          Ajuste Manual — {produtoCodigo}
        </h3>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Período
          </label>
          <input
            type="text"
            value={periodo}
            readOnly
            className="w-full rounded-md border bg-gray-50 px-3 py-2 text-sm"
          />
        </div>

        {originalP50 != null && (
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Valor Original (P50)
            </label>
            <input
              type="text"
              value={originalP50.toFixed(2)}
              readOnly
              className="w-full rounded-md border bg-gray-50 px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Novo Valor (P50)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={overrideP50}
            onChange={(e) => setOverrideP50(Number(e.target.value))}
            required
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Categoria
          </label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaOverride)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Motivo
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            required
            rows={3}
            placeholder="Descreva o motivo do ajuste..."
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        {createOverride.error && (
          <p className="mb-3 text-sm text-red-600">
            Erro: {createOverride.error.message}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={createOverride.isPending || !motivo.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {createOverride.isPending ? 'Salvando...' : 'Salvar Override'}
          </button>
        </div>
      </form>
    </div>
  );
}
