'use client';

import { useDriftStatus, useTriggerDriftCheck } from '@/hooks/use-drift';
import type { DriftCheckResult } from '@/hooks/use-drift';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG = {
  STABLE: { variant: 'success' as const, label: 'Estável' },
  WARNING: { variant: 'warning' as const, label: 'Atenção' },
  DRIFTING: { variant: 'error' as const, label: 'Drift' },
} as const;

function MapeSparkline({ mapes }: { readonly mapes: readonly number[] }) {
  if (mapes.length === 0) return null;

  const max = Math.max(...mapes);
  const min = Math.min(...mapes);
  const range = max - min || 1;
  const width = 120;
  const height = 24;
  const padding = 2;

  // Reverse so most recent is on the right
  const reversed = [...mapes].reverse();
  const points = reversed
    .map((v, i) => {
      const x = padding + (i / Math.max(reversed.length - 1, 1)) * (width - 2 * padding);
      const y = height - padding - ((v - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      className="inline-block"
      aria-label={`MAPE trend: ${reversed.map((m) => m.toFixed(1)).join(', ')}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-gray-400"
      />
      {/* Latest value dot */}
      {reversed.length > 0 && (
        <circle
          cx={padding + ((reversed.length - 1) / Math.max(reversed.length - 1, 1)) * (width - 2 * padding)}
          cy={height - padding - ((reversed[reversed.length - 1] - min) / range) * (height - 2 * padding)}
          r="2.5"
          className="fill-current text-blue-500"
        />
      )}
    </svg>
  );
}

function DriftCard({ drift }: { readonly drift: DriftCheckResult }) {
  const config = STATUS_CONFIG[drift.status];

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">{drift.tipoModelo}</span>
        <Badge variant={config.variant}>{config.label}</Badge>
        {drift.mapeIncreasePct > 0 && (
          <span className="text-xs text-red-500">
            +{(drift.mapeIncreasePct * 100).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-xs text-gray-500">
            MAPE: {drift.currentMape.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-400">
            Média: {drift.rollingAvgMape.toFixed(2)}%
          </div>
        </div>
        <MapeSparkline mapes={drift.recentMapes} />
      </div>
    </div>
  );
}

export function DriftMonitor() {
  const { data: driftResults, isLoading } = useDriftStatus();
  const triggerCheck = useTriggerDriftCheck();

  const results = Array.isArray(driftResults) ? driftResults : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Monitoramento de Drift</CardTitle>
        <button
          type="button"
          className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          onClick={() => triggerCheck.mutate(undefined)}
          disabled={triggerCheck.isPending}
        >
          {triggerCheck.isPending ? 'Verificando...' : 'Verificar Drift'}
        </button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando status de drift...</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum modelo monitorado.</p>
        ) : (
          <div className="space-y-3">
            {results.map((drift) => (
              <DriftCard key={drift.tipoModelo} drift={drift} />
            ))}
          </div>
        )}
        {triggerCheck.error && (
          <p className="mt-2 text-sm text-red-600">
            Erro na verificação: {triggerCheck.error.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
