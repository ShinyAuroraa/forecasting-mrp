'use client';

import { useState } from 'react';
import { useExecutions, useExecuteForecast } from '@/hooks/use-forecast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import type { ExecutionStatus, JobType } from '@/types/forecast';

const statusVariant: Record<ExecutionStatus, BadgeProps['variant']> = {
  queued: 'default',
  running: 'info',
  completed: 'success',
  failed: 'error',
};

const statusLabel: Record<ExecutionStatus, string> = {
  queued: 'Na fila',
  running: 'Executando',
  completed: 'Concluído',
  failed: 'Falhou',
};

const jobTypeLabel: Record<JobType, string> = {
  train_model: 'Treinamento',
  run_forecast: 'Previsão',
  run_backtest: 'Backtest',
};

export function ExecutionPanel() {
  const [jobType, setJobType] = useState<JobType>('run_forecast');
  const { data: executions, isLoading } = useExecutions({ limit: 5 });
  const executeMutation = useExecuteForecast();

  const handleExecute = () => {
    executeMutation.mutate({ jobType });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Execuções</CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={jobType}
              onChange={(e) => setJobType(e.target.value as JobType)}
              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="run_forecast">Previsão</option>
              <option value="train_model">Treinamento</option>
              <option value="run_backtest">Backtest</option>
            </select>
            <Button
              onClick={handleExecute}
              disabled={executeMutation.isPending}
            >
              {executeMutation.isPending ? 'Executando...' : 'Executar'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : !executions?.data.length ? (
          <p className="text-sm text-gray-500">
            Nenhuma execução encontrada.
          </p>
        ) : (
          <div className="space-y-3">
            {executions.data.map((exec) => (
              <div
                key={exec.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant[exec.status]}>
                    {statusLabel[exec.status]}
                  </Badge>
                  <span className="text-sm font-medium">
                    {jobTypeLabel[exec.jobType]}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  {exec.durationSeconds != null && (
                    <span>{exec.durationSeconds}s</span>
                  )}
                  <span>{formatDate(exec.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
