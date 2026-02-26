'use client';

import { useMonteCarloSimulation, type MonteCarloResult, type HistogramBucket } from '@/hooks/use-monte-carlo';

interface MonteCarloSimulationProps {
  readonly produtoId: string | null;
  readonly metodoCalculo?: string | null;
}

/**
 * Monte Carlo safety stock badge and histogram visualization.
 *
 * When metodoCalculo is MONTE_CARLO, shows a badge indicator.
 * Includes a "Simular" button to trigger on-demand simulation
 * and a histogram visualization of the demand distribution.
 *
 * @see Story 5.2 — AC-13, AC-14
 */
export function MonteCarloSimulation({ produtoId, metodoCalculo }: MonteCarloSimulationProps) {
  const { mutate, data, isPending, error } = useMonteCarloSimulation();

  const handleSimulate = () => {
    if (produtoId) {
      mutate({ produtoId });
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Simulação Monte Carlo
          {metodoCalculo === 'MONTE_CARLO' && (
            <span className="ml-2 rounded bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              Monte Carlo
            </span>
          )}
        </h3>

        <button
          type="button"
          onClick={handleSimulate}
          disabled={!produtoId || isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? 'Simulando...' : 'Simular'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded bg-destructive/10 p-3 text-sm text-destructive">
          Erro na simulação: {(error as Error).message}
        </div>
      )}

      {data && <MonteCarloResultCard result={data} />}

      {!data && !isPending && !error && (
        <p className="text-sm text-muted-foreground">
          Clique em &quot;Simular&quot; para executar a simulação Monte Carlo
          de estoque de segurança para este produto.
        </p>
      )}
    </div>
  );
}

function MonteCarloResultCard({ result }: { readonly result: MonteCarloResult }) {
  return (
    <div className="space-y-4">
      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          label="Estoque Segurança"
          value={result.safetyStock.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
        />
        <MetricCard
          label="Demanda Média (LT)"
          value={result.meanDemandOverLt.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
        />
        <MetricCard
          label="IC 90% (P5)"
          value={result.confidenceInterval.p5.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
        />
        <MetricCard
          label="IC 90% (P95)"
          value={result.confidenceInterval.p95.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {result.iterations.toLocaleString('pt-BR')} iterações
      </p>

      {/* Histogram */}
      {result.histogram.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">Distribuição de Demanda no Lead Time</h4>
          <Histogram buckets={result.histogram} />
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-md border bg-muted/50 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Histogram({ buckets }: { readonly buckets: readonly HistogramBucket[] }) {
  const maxCount = Math.max(...buckets.map((b) => b.count));

  return (
    <div className="flex h-32 items-end gap-px" role="img" aria-label="Histograma de demanda">
      {buckets.map((bucket, i) => {
        const heightPct = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
        return (
          <div
            key={i}
            className="group relative flex-1"
            title={`${bucket.rangeMin.toLocaleString('pt-BR')} – ${bucket.rangeMax.toLocaleString('pt-BR')}: ${bucket.count}`}
          >
            <div
              className="w-full rounded-t bg-violet-500 transition-colors group-hover:bg-violet-400"
              style={{ height: `${heightPct}%`, minHeight: bucket.count > 0 ? '2px' : '0' }}
            />
          </div>
        );
      })}
    </div>
  );
}
