/**
 * Scenario types for What-If Scenario Analysis.
 *
 * @see Story 4.9 — FR-057
 */

export const SCENARIO_KEY_PREFIX = 'cenario.whatif.';

export interface ScenarioAdjustment {
  readonly globalMultiplier: number;
  readonly classMultipliers: {
    readonly A: number;
    readonly B: number;
    readonly C: number;
  };
  readonly skuOverrides: readonly SkuOverride[];
}

export interface SkuOverride {
  readonly produtoId: string;
  readonly weeklyDemand: readonly number[];
}

export interface ScenarioData {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly adjustments: ScenarioAdjustment;
  readonly createdAt: string;
  readonly createdBy: string | null;
}

export interface ScenarioImpact {
  readonly scenarioId: string;
  readonly baseline: ImpactMetrics;
  readonly scenario: ImpactMetrics;
  readonly delta: ImpactDelta;
  readonly forecastComparison: readonly ForecastComparisonPoint[];
}

export interface ImpactMetrics {
  readonly totalPlannedOrders: number;
  readonly purchaseOrderCount: number;
  readonly productionOrderCount: number;
  readonly totalOrderValue: number;
  readonly avgCapacityUtilization: number;
  readonly totalInventoryValue: number;
}

export interface ImpactDelta {
  readonly plannedOrdersDelta: number;
  readonly orderValueDelta: number;
  readonly capacityDelta: number;
  readonly inventoryDelta: number;
}

export interface ForecastComparisonPoint {
  readonly period: string;
  readonly baselineRevenue: number;
  readonly scenarioRevenue: number;
}

// CreateScenarioDto is defined as a class in dto/create-scenario.dto.ts
