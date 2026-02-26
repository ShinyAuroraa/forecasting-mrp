'use client';

import { useState } from 'react';
import { useMetrics } from '@/hooks/use-forecast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatNumber } from '@/lib/utils';

export function MetricsTable() {
  const [page, setPage] = useState(1);
  const [classeFilter, setClasseFilter] = useState<string>('');
  const [modelFilter, setModelFilter] = useState<string>('');

  const { data: metrics, isLoading } = useMetrics({
    page,
    limit: 10,
    classeAbc: classeFilter || undefined,
    modelName: modelFilter || undefined,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Métricas de Acurácia</CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={classeFilter}
              onChange={(e) => {
                setClasseFilter(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs"
            >
              <option value="">Todas Classes</option>
              <option value="A">Classe A</option>
              <option value="B">Classe B</option>
              <option value="C">Classe C</option>
            </select>
            <select
              value={modelFilter}
              onChange={(e) => {
                setModelFilter(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs"
            >
              <option value="">Todos Modelos</option>
              <option value="NAIVE">Naive</option>
              <option value="ETS">ETS</option>
              <option value="CROSTON">Croston</option>
              <option value="TFT">TFT</option>
              <option value="LGBM">LightGBM</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando métricas...</p>
        ) : !metrics?.data.length ? (
          <p className="text-sm text-gray-500">Nenhuma métrica disponível.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead className="text-right">MAPE</TableHead>
                  <TableHead className="text-right">MAE</TableHead>
                  <TableHead className="text-right">RMSE</TableHead>
                  <TableHead className="text-right">Bias</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.data.map((metric) => (
                  <TableRow key={metric.id}>
                    <TableCell className="font-medium">
                      {metric.produtoId}
                    </TableCell>
                    <TableCell>
                      <Badge variant={metric.isBaseline ? 'default' : 'info'}>
                        {metric.modelName}
                      </Badge>
                    </TableCell>
                    <TableCell>{metric.classeAbc ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(metric.mape)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(metric.mae)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(metric.rmse)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          metric.bias > 0
                            ? 'text-red-600'
                            : metric.bias < 0
                              ? 'text-blue-600'
                              : ''
                        }
                      >
                        {formatNumber(metric.bias)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {metrics.meta.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Página {metrics.meta.page} de {metrics.meta.totalPages} (
                  {metrics.meta.total} registros)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!metrics.meta.hasPrev}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!metrics.meta.hasNext}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
