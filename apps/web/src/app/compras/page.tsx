import { PurchasingPanel } from '@/components/purchasing/purchasing-panel';

export const metadata = {
  title: 'Painel de Compras — ForecastingMRP',
};

export default function ComprasPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Painel de Compras</h1>
      <PurchasingPanel />
    </main>
  );
}
