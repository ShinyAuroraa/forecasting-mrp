'use client';

import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
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
import { formatBRL } from '@/lib/format';
import type { UrgentAction, PrioridadeOrdem } from '@/types/purchasing';

interface UrgentActionsTableProps {
  readonly actions: readonly UrgentAction[];
}

type SortField =
  | 'produtoCodigo'
  | 'quantidade'
  | 'fornecedorNome'
  | 'dataLiberacao'
  | 'dataNecessidade'
  | 'custoEstimado'
  | 'prioridade';

type SortDirection = 'asc' | 'desc';

/** Map priority to Badge variant. */
const priorityVariant: Record<PrioridadeOrdem, BadgeProps['variant']> = {
  CRITICA: 'error',
  ALTA: 'warning',
  MEDIA: 'info',
  BAIXA: 'default',
};

/** Map priority to display label. */
const priorityLabel: Record<PrioridadeOrdem, string> = {
  CRITICA: 'Cr\u00edtica',
  ALTA: 'Alta',
  MEDIA: 'M\u00e9dia',
  BAIXA: 'Baixa',
};

/** Priority sort order (CRITICA first). */
const prioritySortOrder: Record<string, number> = {
  CRITICA: 0,
  ALTA: 1,
  MEDIA: 2,
  BAIXA: 3,
};

/**
 * Urgent Actions table with sorting and filtering.
 *
 * Displays COMPRA orders due within the next 7 days.
 *
 * @see Story 3.11 — Purchasing Panel (AC-9, AC-15)
 */
export function UrgentActionsTable({ actions }: UrgentActionsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('dataLiberacao');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortIndicator = (field: SortField): string => {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? ' \u2191' : ' \u2193';
  };

  const filteredAndSorted = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();

    const filtered =
      searchTerm.length === 0
        ? [...actions]
        : actions.filter(
            (a) =>
              a.produtoCodigo.toLowerCase().includes(lowerSearch) ||
              a.produtoDescricao.toLowerCase().includes(lowerSearch) ||
              a.fornecedorNome.toLowerCase().includes(lowerSearch),
          );

    return [...filtered].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;

      switch (sortField) {
        case 'produtoCodigo':
          return dir * a.produtoCodigo.localeCompare(b.produtoCodigo);
        case 'quantidade':
          return dir * (a.quantidade - b.quantidade);
        case 'fornecedorNome':
          return dir * a.fornecedorNome.localeCompare(b.fornecedorNome);
        case 'dataLiberacao':
          return (
            dir *
            (new Date(a.dataLiberacao).getTime() -
              new Date(b.dataLiberacao).getTime())
          );
        case 'dataNecessidade':
          return (
            dir *
            (new Date(a.dataNecessidade).getTime() -
              new Date(b.dataNecessidade).getTime())
          );
        case 'custoEstimado':
          return dir * (a.custoEstimado - b.custoEstimado);
        case 'prioridade':
          return (
            dir *
            ((prioritySortOrder[a.prioridade] ?? 9) -
              (prioritySortOrder[b.prioridade] ?? 9))
          );
        default:
          return 0;
      }
    });
  }, [actions, searchTerm, sortField, sortDirection]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            A\u00e7\u00f5es Urgentes ({actions.length})
          </CardTitle>
          <input
            type="text"
            placeholder="Buscar por SKU, descri\u00e7\u00e3o ou fornecedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 w-72 rounded-md border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </CardHeader>
      <CardContent>
        {filteredAndSorted.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhuma a\u00e7\u00e3o urgente encontrada.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('produtoCodigo')}
                >
                  SKU{sortIndicator('produtoCodigo')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('quantidade')}
                >
                  Quantidade{sortIndicator('quantidade')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('fornecedorNome')}
                >
                  Fornecedor{sortIndicator('fornecedorNome')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('dataLiberacao')}
                >
                  Data Libera\u00e7\u00e3o{sortIndicator('dataLiberacao')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('dataNecessidade')}
                >
                  Data Necessidade{sortIndicator('dataNecessidade')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('custoEstimado')}
                >
                  Custo Estimado{sortIndicator('custoEstimado')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('prioridade')}
                >
                  Prioridade{sortIndicator('prioridade')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.map((action) => (
                <TableRow key={action.orderId}>
                  <TableCell>
                    <div>
                      <span className="font-medium">
                        {action.produtoCodigo}
                      </span>
                      <p className="text-xs text-gray-500">
                        {action.produtoDescricao}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {action.quantidade.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell>{action.fornecedorNome}</TableCell>
                  <TableCell>
                    {format(parseISO(action.dataLiberacao), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    {format(parseISO(action.dataNecessidade), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatBRL(action.custoEstimado)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={priorityVariant[action.prioridade]}>
                      {priorityLabel[action.prioridade]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
