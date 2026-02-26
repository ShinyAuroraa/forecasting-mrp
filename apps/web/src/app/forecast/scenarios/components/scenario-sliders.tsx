'use client';

import type { ScenarioAdjustment } from '@/types/scenario';

interface ScenarioSlidersProps {
  readonly adjustments: ScenarioAdjustment;
  readonly onChange: (adjustments: ScenarioAdjustment) => void;
}

function SliderControl({
  label,
  value,
  onChange,
  min = 0.5,
  max = 2.0,
  step = 0.05,
}: {
  readonly label: string;
  readonly value: number;
  readonly onChange: (v: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}) {
  return (
    <div className="flex items-center gap-4">
      <label className="w-32 text-sm font-medium">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1"
        data-testid={`slider-${label.toLowerCase().replace(/\s+/g, '-')}`}
      />
      <span className="w-16 text-right text-sm font-bold">{value.toFixed(2)}x</span>
    </div>
  );
}

/**
 * Scenario adjustment sliders — global, per-class (A/B/C), and per-SKU overrides.
 *
 * @see Story 4.9 — AC-2, AC-3, AC-4, AC-15
 */
export function ScenarioSliders({ adjustments, onChange }: ScenarioSlidersProps) {
  return (
    <div data-testid="scenario-sliders" className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold">Ajustes de Demanda</h3>

      <div className="space-y-3">
        <SliderControl
          label="Global"
          value={adjustments.globalMultiplier}
          onChange={(v) =>
            onChange({ ...adjustments, globalMultiplier: v })
          }
        />

        <div className="border-t pt-3">
          <p className="mb-2 text-xs text-gray-500">Por Classe ABC</p>
          <SliderControl
            label="Classe A"
            value={adjustments.classMultipliers.A}
            onChange={(v) =>
              onChange({
                ...adjustments,
                classMultipliers: { ...adjustments.classMultipliers, A: v },
              })
            }
          />
          <SliderControl
            label="Classe B"
            value={adjustments.classMultipliers.B}
            onChange={(v) =>
              onChange({
                ...adjustments,
                classMultipliers: { ...adjustments.classMultipliers, B: v },
              })
            }
          />
          <SliderControl
            label="Classe C"
            value={adjustments.classMultipliers.C}
            onChange={(v) =>
              onChange({
                ...adjustments,
                classMultipliers: { ...adjustments.classMultipliers, C: v },
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
