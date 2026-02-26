import { ExecutionPanel } from '@/components/forecast/execution-panel';
import { ForecastChart } from '@/components/forecast/forecast-chart';
import { MetricsTable } from '@/components/forecast/metrics-table';
import { ModelList } from '@/components/forecast/model-list';
import { ChampionHistory } from '@/components/forecast/champion-history';
import { DriftMonitor } from '@/components/forecast/drift-monitor';
import { OverrideHistory } from '@/components/forecast/override-history';

export const metadata = {
  title: 'Previsão de Demanda — ForecastingMRP',
};

export default function ForecastPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Previsão de Demanda</h1>

      <ExecutionPanel />

      <ForecastChart />

      <MetricsTable />

      <ModelList />

      <DriftMonitor />

      <ChampionHistory />

      <OverrideHistory />
    </main>
  );
}
