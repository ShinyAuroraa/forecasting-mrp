'use client';

import dynamic from 'next/dynamic';
import type { EChartsOption } from 'echarts';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface ChartBaseProps {
  readonly option: EChartsOption;
  readonly height?: string;
  readonly notMerge?: boolean;
  readonly className?: string;
  readonly onEvents?: Record<string, (params: unknown) => void>;
}

/**
 * Reusable ECharts wrapper with SSR-safe dynamic import.
 *
 * All MRP dashboard charts use this as their rendering base.
 *
 * @see Story 3.12 — MRP & Capacity Dashboards (AC-18)
 */
export function ChartBase({
  option,
  height = '400px',
  notMerge = true,
  className = '',
  onEvents,
}: ChartBaseProps) {
  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ReactECharts
        option={option}
        style={{ height: '100%', width: '100%' }}
        notMerge={notMerge}
        onEvents={onEvents}
      />
    </div>
  );
}
