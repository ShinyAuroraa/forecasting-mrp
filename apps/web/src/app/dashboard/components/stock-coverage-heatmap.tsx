'use client';

import { useRouter } from 'next/navigation';
import type { StockCoverageData } from '@/types/dashboard';
import { COVERAGE_COLORS } from '@/types/dashboard';

interface StockCoverageHeatmapProps {
  readonly data: StockCoverageData;
}

/**
 * Stock Coverage Heatmap — rows = top 50 SKUs, coverage days colored.
 *
 * Color coding (AC-12):
 * - red < 7 days, orange 7-14 days, yellow 14-30 days, green > 30 days
 *
 * @see Story 4.8 — AC-11, AC-12, AC-13
 */
export function StockCoverageHeatmap({ data }: StockCoverageHeatmapProps) {
  const router = useRouter();

  return (
    <div data-testid="stock-coverage-heatmap" className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold">Cobertura de Estoque</h3>

      <div className="mb-3 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded" style={{ background: COVERAGE_COLORS.red }} />
          {'< 7 dias'}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded" style={{ background: COVERAGE_COLORS.orange }} />
          7-14 dias
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded" style={{ background: COVERAGE_COLORS.yellow }} />
          14-30 dias
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded" style={{ background: COVERAGE_COLORS.green }} />
          {'> 30 dias'}
        </span>
      </div>

      <div className="max-h-[400px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Código</th>
              <th className="px-3 py-2 text-left font-medium">Descrição</th>
              <th className="px-3 py-2 text-center font-medium">ABC</th>
              <th className="px-3 py-2 text-center font-medium">Cobertura</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr
                key={item.produtoId}
                data-testid={`coverage-row-${item.codigo}`}
                className="cursor-pointer border-t hover:bg-gray-50"
                onClick={() => router.push(`/estoque/projecao?produtoId=${encodeURIComponent(item.produtoId)}`)}
              >
                <td className="px-3 py-2 font-mono text-xs">{item.codigo}</td>
                <td className="max-w-[200px] truncate px-3 py-2">{item.descricao}</td>
                <td className="px-3 py-2 text-center">
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">{item.classeAbc}</span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className="inline-block min-w-[60px] rounded px-2 py-1 text-xs font-bold text-white"
                    style={{ backgroundColor: COVERAGE_COLORS[item.colorZone] }}
                  >
                    {item.coverageDays} dias
                  </span>
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                  Nenhum dado de cobertura disponível
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
