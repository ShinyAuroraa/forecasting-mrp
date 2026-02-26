'use client';

import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface ForecastChartProps {
  title?: string;
}

export function ForecastChart({ title = 'Previsão de Demanda' }: ForecastChartProps) {
  const option = {
    tooltip: {
      trigger: 'axis' as const,
    },
    legend: {
      data: ['Histórico', 'Forecast (P50)', 'P10', 'P90'],
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '12%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category' as const,
      boundaryGap: false,
      data: [] as string[],
      axisLabel: { rotate: 45, fontSize: 11 },
    },
    yAxis: {
      type: 'value' as const,
      name: 'Volume',
    },
    series: [
      {
        name: 'Histórico',
        type: 'line' as const,
        data: [] as number[],
        lineStyle: { color: '#374151' },
        itemStyle: { color: '#374151' },
      },
      {
        name: 'Forecast (P50)',
        type: 'line' as const,
        data: [] as number[],
        lineStyle: { color: '#3B82F6', type: 'dashed' as const },
        itemStyle: { color: '#3B82F6' },
      },
      {
        name: 'P90',
        type: 'line' as const,
        data: [] as number[],
        lineStyle: { opacity: 0 },
        areaStyle: { color: 'rgba(59, 130, 246, 0.1)' },
        stack: 'confidence',
        symbol: 'none',
      },
      {
        name: 'P10',
        type: 'line' as const,
        data: [] as number[],
        lineStyle: { opacity: 0 },
        areaStyle: { color: 'rgba(59, 130, 246, 0.1)' },
        stack: 'confidence',
        symbol: 'none',
      },
    ],
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ReactECharts
            option={option}
            style={{ height: '100%', width: '100%' }}
            notMerge
          />
        </div>
        <p className="mt-2 text-center text-sm text-gray-400">
          Execute uma previsão para visualizar os dados.
        </p>
      </CardContent>
    </Card>
  );
}
