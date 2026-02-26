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
import { formatBRL } from '@/lib/format';
import type { SupplierSummary } from '@/types/purchasing';

interface SupplierSummaryTableProps {
  readonly suppliers: readonly SupplierSummary[];
}

type SortField = 'fornecedorNome' | 'totalOrders' | 'totalQuantidade' | 'totalCusto';
type SortDirection = 'asc' | 'desc';

/**
 * Supplier Summary table with expandable rows.
 *
 * Shows COMPRA orders grouped by supplier. Click a row to expand
 * and see individual orders for that supplier.
 *
 * @see Story 3.11 — Purchasing Panel (AC-4, AC-10, AC-15)
 */
export function SupplierSummaryTable({ suppliers }: SupplierSummaryTableProps) {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('totalCusto');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const toggleExpand = (fornecedorId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fornecedorId)) {
        next.delete(fornecedorId);
      } else {
        next.add(fornecedorId);
      }
      return next;
    });
  };

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
        ? [...suppliers]
        : suppliers.filter((s) =>
            s.fornecedorNome.toLowerCase().includes(lowerSearch),
          );

    return [...filtered].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;

      switch (sortField) {
        case 'fornecedorNome':
          return dir * a.fornecedorNome.localeCompare(b.fornecedorNome);
        case 'totalOrders':
          return dir * (a.totalOrders - b.totalOrders);
        case 'totalQuantidade':
          return dir * (a.totalQuantidade - b.totalQuantidade);
        case 'totalCusto':
          return dir * (a.totalCusto - b.totalCusto);
        default:
          return 0;
      }
    });
  }, [suppliers, searchTerm, sortField, sortDirection]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Resumo por Fornecedor ({suppliers.length})</CardTitle>
          <input
            type="text"
            placeholder="Buscar fornecedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 w-64 rounded-md border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </CardHeader>
      <CardContent>
        {filteredAndSorted.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhum fornecedor encontrado.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('fornecedorNome')}
                >
                  Fornecedor{sortIndicator('fornecedorNome')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('totalOrders')}
                >
                  Total Ordens{sortIndicator('totalOrders')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('totalQuantidade')}
                >
                  Total Quantidade{sortIndicator('totalQuantidade')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('totalCusto')}
                >
                  Total Custo{sortIndicator('totalCusto')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.map((supplier) => {
                const isExpanded = expandedIds.has(supplier.fornecedorId);

                return (
                  <SupplierRow
                    key={supplier.fornecedorId}
                    supplier={supplier}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpand(supplier.fornecedorId)}
                  />
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────
// SupplierRow — Expandable row for a single supplier
// ────────────────────────────────────────────────────────────────

interface SupplierRowProps {
  readonly supplier: SupplierSummary;
  readonly isExpanded: boolean;
  readonly onToggle: () => void;
}

function SupplierRow({ supplier, isExpanded, onToggle }: SupplierRowProps) {
  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={onToggle}
      >
        <TableCell className="w-8 text-center">
          {isExpanded ? '\u25BC' : '\u25B6'}
        </TableCell>
        <TableCell className="font-medium">
          {supplier.fornecedorNome}
        </TableCell>
        <TableCell className="text-right">
          {supplier.totalOrders}
        </TableCell>
        <TableCell className="text-right">
          {supplier.totalQuantidade.toLocaleString('pt-BR')}
        </TableCell>
        <TableCell className="text-right font-medium">
          {formatBRL(supplier.totalCusto)}
        </TableCell>
      </TableRow>
      {isExpanded && supplier.orders.length > 0 && (
        <TableRow>
          <TableCell colSpan={5} className="bg-gray-50 p-0">
            <div className="px-8 py-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-2 pr-4">SKU</th>
                    <th className="pb-2 pr-4">Descri\u00e7\u00e3o</th>
                    <th className="pb-2 pr-4 text-right">Quantidade</th>
                    <th className="pb-2 pr-4 text-right">Custo</th>
                    <th className="pb-2 pr-4">Data Libera\u00e7\u00e3o</th>
                    <th className="pb-2">Prioridade</th>
                  </tr>
                </thead>
                <tbody>
                  {supplier.orders.map((order) => (
                    <tr key={order.orderId} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">
                        {order.produtoCodigo}
                      </td>
                      <td className="py-2 pr-4">{order.produtoDescricao}</td>
                      <td className="py-2 pr-4 text-right">
                        {order.quantidade.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {formatBRL(order.custoEstimado)}
                      </td>
                      <td className="py-2 pr-4">
                        {format(parseISO(order.dataLiberacao), 'dd/MM/yyyy')}
                      </td>
                      <td className="py-2">{order.prioridade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
