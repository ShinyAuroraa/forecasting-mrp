'use client';

import { useState } from 'react';
import {
  useScenarios,
  useCreateScenario,
  useDeleteScenario,
  useScenarioImpact,
} from '@/hooks/use-scenarios';
import { DEFAULT_ADJUSTMENTS, type ScenarioAdjustment } from '@/types/scenario';
import { ScenarioSliders } from './components/scenario-sliders';
import { ImpactSummary } from './components/impact-summary';
import { ComparisonChart } from './components/comparison-chart';

/**
 * What-If Scenario Analysis page.
 *
 * @see Story 4.9 — AC-14
 */
export default function ScenariosPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [adjustments, setAdjustments] = useState<ScenarioAdjustment>(DEFAULT_ADJUSTMENTS);

  const scenarios = useScenarios();
  const createScenario = useCreateScenario();
  const deleteScenario = useDeleteScenario();
  const impact = useScenarioImpact(selectedId);

  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreateError(null);
    try {
      const result = await createScenario.mutateAsync({ name, description, adjustments });
      setIsCreating(false);
      setName('');
      setDescription('');
      setAdjustments(DEFAULT_ADJUSTMENTS);
      setSelectedId(result.id);
    } catch {
      setCreateError('Erro ao criar cenário. Tente novamente.');
    }
  };

  return (
    <div data-testid="scenarios-page" className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Análise What-If</h1>
        <button
          data-testid="btn-new-scenario"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={() => setIsCreating(true)}
        >
          Novo Cenário
        </button>
      </div>

      {/* Creation wizard */}
      {isCreating && (
        <div data-testid="scenario-wizard" className="space-y-4 rounded-xl border-2 border-blue-200 bg-blue-50 p-6">
          <h2 className="text-lg font-semibold">Criar Cenário</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Nome</label>
              <input
                data-testid="input-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="Ex: Aumento 20% Classe A"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Descrição</label>
              <input
                data-testid="input-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="Cenário otimista para Q2"
              />
            </div>
          </div>

          <ScenarioSliders adjustments={adjustments} onChange={setAdjustments} />

          {createError && (
            <p data-testid="create-error" className="text-sm text-red-600">{createError}</p>
          )}
          <div className="flex gap-2">
            <button
              data-testid="btn-save-scenario"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={handleCreate}
              disabled={createScenario.isPending || !name.trim()}
            >
              {createScenario.isPending ? 'Salvando...' : 'Salvar Cenário'}
            </button>
            <button
              className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
              onClick={() => setIsCreating(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Scenario list */}
      <div data-testid="scenario-list" className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Cenários Salvos</h2>
        {scenarios.isLoading && <p className="text-gray-400">Carregando...</p>}
        {scenarios.data?.length === 0 && (
          <p className="py-4 text-center text-gray-400">Nenhum cenário criado ainda</p>
        )}
        <div className="space-y-2">
          {scenarios.data?.map((s) => (
            <div
              key={s.id}
              data-testid={`scenario-${s.id}`}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 transition ${
                selectedId === s.id ? 'border-blue-400 bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <button
                className="flex-1 text-left"
                onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
              >
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-gray-500">
                  {s.description} — {new Date(s.createdAt).toLocaleDateString('pt-BR')}
                  {' | Global: '}
                  {s.adjustments.globalMultiplier.toFixed(2)}x
                </p>
              </button>
              <button
                data-testid={`btn-delete-${s.id}`}
                className="ml-2 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                onClick={() => {
                  if (!window.confirm(`Excluir o cenário "${s.name}"? Esta ação é irreversível.`)) return;
                  deleteScenario.mutate(s.id);
                  if (selectedId === s.id) setSelectedId(null);
                }}
              >
                Excluir
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Impact analysis */}
      {selectedId && impact.isLoading && (
        <p className="text-gray-400">Calculando impacto...</p>
      )}
      {selectedId && impact.isError && (
        <p data-testid="impact-error" className="text-red-600">Erro ao calcular impacto</p>
      )}
      {impact.data && (
        <>
          <ImpactSummary impact={impact.data} />
          <ComparisonChart points={impact.data.forecastComparison} />
        </>
      )}
    </div>
  );
}
