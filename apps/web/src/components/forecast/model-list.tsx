'use client';

import { useModels } from '@/hooks/use-forecast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

export function ModelList() {
  const { data: models, isLoading } = useModels();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modelos de Forecast</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando modelos...</p>
        ) : !models?.data.length ? (
          <p className="text-sm text-gray-500">Nenhum modelo treinado.</p>
        ) : (
          <div className="space-y-3">
            {models.data.map((model) => (
              <div
                key={model.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">
                    {model.modelName}
                  </span>
                  <span className="text-xs text-gray-500">
                    v{model.version}
                  </span>
                  {model.isChampion && (
                    <Badge variant="success">Champion</Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {model.trainingMetrics?.mape != null && (
                    <span>MAPE: {model.trainingMetrics.mape.toFixed(2)}%</span>
                  )}
                  <span>Treinado: {formatDate(model.trainedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
