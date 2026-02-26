'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { CapacityWeekRecord, OverloadAlert, SugestaoCapacidade } from '@/types/mrp';

interface OverloadAlertsProps {
  readonly records: readonly CapacityWeekRecord[];
}

const sugestaoVariant: Record<SugestaoCapacidade, BadgeProps['variant']> = {
  OK: 'success',
  HORA_EXTRA: 'warning',
  ANTECIPAR: 'default',
  SUBCONTRATAR: 'error',
};

/** ANTECIPAR uses orange (not available as a Badge variant). */
const sugestaoClassName: Partial<Record<SugestaoCapacidade, string>> = {
  ANTECIPAR: 'bg-orange-100 text-orange-800',
};

const sugestaoLabel: Record<SugestaoCapacidade, string> = {
  OK: 'OK',
  HORA_EXTRA: 'Hora Extra',
  ANTECIPAR: 'Antecipar',
  SUBCONTRATAR: 'Subcontratar',
};

/**
 * Overload alerts list for work centers with utilization > 100%.
 *
 * Shows a table with work center name, week, utilization %, excess hours,
 * and a badge with the suggested corrective action.
 *
 * @see Story 3.12 — Capacity Dashboard (AC-16)
 */
export function OverloadAlerts({ records }: OverloadAlertsProps) {
  const alerts: readonly OverloadAlert[] = useMemo(() => {
    return records
      .filter((rec) => rec.sobrecarga)
      .map((rec) => ({
        centroTrabalhoId: rec.centroTrabalhoId,
        centroTrabalhoCodigo: rec.centroTrabalho?.codigo ?? '',
        centroTrabalhoNome: rec.centroTrabalho?.nome ?? rec.centroTrabalhoId.slice(0, 8),
        periodStart: rec.periodStart,
        utilizacaoPercentual: rec.utilizacaoPercentual,
        horasExcedentes: rec.horasExcedentes,
        sugestao: rec.sugestao ?? 'HORA_EXTRA',
      }))
      .sort((a, b) => b.utilizacaoPercentual - a.utilizacaoPercentual);
  }, [records]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Alertas de Sobrecarga ({alerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhuma sobrecarga detectada. Todos os centros de trabalho estão dentro da capacidade.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Centro de Trabalho</TableHead>
                <TableHead>Semana</TableHead>
                <TableHead className="text-right">Utilização</TableHead>
                <TableHead className="text-right">Horas Excedentes</TableHead>
                <TableHead>Sugestão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => {
                const weekLabel = new Date(alert.periodStart).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                });
                return (
                  <TableRow key={`${alert.centroTrabalhoId}-${alert.periodStart}`}>
                    <TableCell className="font-medium">
                      {alert.centroTrabalhoNome}
                    </TableCell>
                    <TableCell>{weekLabel}</TableCell>
                    <TableCell className="text-right font-medium text-red-600">
                      {alert.utilizacaoPercentual.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {alert.horasExcedentes.toFixed(1)}h
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={sugestaoVariant[alert.sugestao]}
                        className={sugestaoClassName[alert.sugestao]}
                      >
                        {sugestaoLabel[alert.sugestao]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
