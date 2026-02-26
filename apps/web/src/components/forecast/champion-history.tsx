'use client';

import { useChampionHistory } from '@/hooks/use-forecast';
import type { ChampionInfo } from '@/hooks/use-forecast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

interface PromotionLog {
  promoted: boolean;
  new_mape: number;
  champion_mape: number | null;
  reason: string;
}

function getPromotionLog(model: ChampionInfo): PromotionLog | null {
  const metrics = model.metricasTreino as Record<string, unknown> | null;
  if (!metrics?.promotion_log) return null;
  return metrics.promotion_log as PromotionLog;
}

function MapeChange({ log }: { readonly log: PromotionLog }) {
  if (log.champion_mape == null) {
    return <span className="text-xs text-gray-500">Primeiro champion</span>;
  }

  const delta = log.new_mape - log.champion_mape;
  const improved = delta < 0;

  return (
    <span className={`text-xs ${improved ? 'text-green-600' : 'text-red-500'}`}>
      {improved ? '' : '+'}{delta.toFixed(2)}% MAPE
    </span>
  );
}

interface ChampionHistoryProps {
  readonly tipoModelo?: string;
}

export function ChampionHistory({ tipoModelo }: ChampionHistoryProps) {
  const { data: history, isLoading } = useChampionHistory(tipoModelo);

  const entries = Array.isArray(history) ? history : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Promoção de Modelos</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando histórico...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum histórico disponível.</p>
        ) : (
          <div className="relative space-y-0">
            {/* Timeline line */}
            <div className="absolute left-3 top-2 bottom-2 w-px bg-gray-200" />

            {entries.map((model) => {
              const log = getPromotionLog(model);
              const avgMape = (model.metricasTreino as Record<string, number> | null)?.avg_mape;

              return (
                <div key={model.id} className="relative flex gap-4 py-3">
                  {/* Timeline dot */}
                  <div
                    className={`relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                      model.isChampion
                        ? 'bg-amber-500 ring-2 ring-amber-200'
                        : log?.promoted
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                    }`}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{model.tipoModelo}</span>
                      <span className="text-xs text-gray-500">v{model.versao}</span>
                      {model.isChampion && (
                        <Badge variant="success">Champion</Badge>
                      )}
                      {log?.promoted && !model.isChampion && (
                        <Badge variant="info">Promovido</Badge>
                      )}
                      {log && !log.promoted && (
                        <Badge variant="warning">Rejeitado</Badge>
                      )}
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                      {avgMape != null && <span>MAPE: {avgMape.toFixed(2)}%</span>}
                      {log && <MapeChange log={log} />}
                      <span>{formatDate(model.createdAt)}</span>
                    </div>

                    {log?.reason && (
                      <p className="mt-0.5 text-xs text-gray-400">{log.reason}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
