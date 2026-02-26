'use client';

import { useOverrides, useRevertOverride, type ForecastOverride } from '@/hooks/use-overrides';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const CATEGORIA_LABELS: Record<string, string> = {
  SEASONAL: 'Sazonalidade',
  PROMOTION: 'Promoção',
  SUPPLY_DISRUPTION: 'Ruptura',
  MARKET_INTELLIGENCE: 'Intel. Mercado',
  OTHER: 'Outro',
};

const CATEGORIA_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  SEASONAL: 'info',
  PROMOTION: 'success',
  SUPPLY_DISRUPTION: 'error',
  MARKET_INTELLIGENCE: 'warning',
  OTHER: 'default',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function OverrideRow({ override }: { readonly override: ForecastOverride }) {
  const revert = useRevertOverride();
  const isRevert = override.revertedFromId != null;
  const delta =
    override.originalP50 != null
      ? override.overrideP50 - override.originalP50
      : null;

  return (
    <div className="flex items-center justify-between border-b py-3 last:border-b-0">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {override.produto?.codigo ?? override.produtoId}
          </span>
          <Badge variant={CATEGORIA_VARIANT[override.categoriaOverride] ?? 'default'}>
            {CATEGORIA_LABELS[override.categoriaOverride] ?? override.categoriaOverride}
          </Badge>
          {isRevert && (
            <Badge variant="warning">Reversão</Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">{override.motivo}</p>
        <p className="text-xs text-gray-400">
          {formatDate(override.createdAt)} — Período: {formatDate(override.periodo)}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          {override.originalP50 != null && (
            <div className="text-xs text-gray-400 line-through">
              {Number(override.originalP50).toFixed(2)}
            </div>
          )}
          <div className="text-sm font-semibold">
            {Number(override.overrideP50).toFixed(2)}
          </div>
          {delta != null && (
            <div
              className={`text-xs ${delta > 0 ? 'text-red-500' : delta < 0 ? 'text-green-500' : 'text-gray-400'}`}
            >
              {delta > 0 ? '+' : ''}
              {delta.toFixed(2)}
            </div>
          )}
        </div>
        {!isRevert && (
          <button
            type="button"
            onClick={() => revert.mutate(override.id)}
            disabled={revert.isPending}
            className="rounded-md border px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            title="Reverter este override"
          >
            {revert.isPending ? '...' : 'Reverter'}
          </button>
        )}
      </div>
    </div>
  );
}

export function OverrideHistory() {
  const { data: overridesResult, isLoading } = useOverrides({ limit: 20 });
  const overrides = overridesResult?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Ajustes Manuais</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando histórico de overrides...</p>
        ) : overrides.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum ajuste manual registrado.</p>
        ) : (
          <div>
            {overrides.map((override) => (
              <OverrideRow key={override.id} override={override} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
