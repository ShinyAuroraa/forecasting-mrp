/**
 * Dashboard types for the Executive BI Dashboard.
 *
 * @see Story 4.8 — FR-054
 */

// ── KPI Cards ──────────────────────────────────────────────

export interface KpiVariation {
  readonly value: number;
  readonly percent: number;
  readonly direction: 'up' | 'down' | 'stable';
}

export interface KpiCard {
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly variation: KpiVariation;
}

export interface DashboardKpis {
  readonly monthlyRevenue: KpiCard;
  readonly forecastAccuracy: KpiCard;
  readonly inventoryTurnover: KpiCard;
  readonly fillRate: KpiCard;
  readonly referenceDate: string;
}

// ── Revenue Chart ──────────────────────────────────────────

export interface RevenueChartPoint {
  readonly period: string;
  readonly actual: number | null;
  readonly forecastIndirect: number | null;
  readonly forecastDirect: number | null;
  readonly p10: number | null;
  readonly p90: number | null;
}

export interface RevenueChartData {
  readonly points: readonly RevenueChartPoint[];
  readonly divergenceFlags: readonly DivergenceFlag[];
}

export interface DivergenceFlag {
  readonly period: string;
  readonly divergencePercent: number;
  readonly message: string;
}

// ── Pareto / ABC ───────────────────────────────────────────

export interface ParetoItem {
  readonly classeAbc: string;
  readonly skuCount: number;
  readonly totalRevenue: number;
  readonly revenuePercent: number;
  readonly cumulativePercent: number;
}

export interface ParetoData {
  readonly items: readonly ParetoItem[];
  readonly totalRevenue: number;
}

// ── Stock Coverage Heatmap ─────────────────────────────────

export interface StockCoverageItem {
  readonly produtoId: string;
  readonly codigo: string;
  readonly descricao: string;
  readonly classeAbc: string;
  readonly coverageDays: number;
  readonly colorZone: 'red' | 'orange' | 'yellow' | 'green';
}

export interface StockCoverageData {
  readonly items: readonly StockCoverageItem[];
}

// ── Active Alerts ──────────────────────────────────────────

export interface AlertSummaryCategory {
  readonly type: string;
  readonly label: string;
  readonly count: number;
}

export interface ActiveAlertsSummary {
  readonly categories: readonly AlertSummaryCategory[];
  readonly total: number;
}
