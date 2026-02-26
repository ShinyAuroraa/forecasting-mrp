import { buildSummaryHtml, buildSummaryText } from '../email-templates';
import type { DailySummaryData } from '../daily-summary.types';

const MOCK_DATA: DailySummaryData = {
  date: 'quarta-feira, 26/02/2026',
  stockAlerts: {
    belowSafetyStock: 2,
    approachingRop: 1,
    criticalSkus: [
      { codigo: 'SKU-001', descricao: 'Produto A', estoqueAtual: 5, estoqueSeguranca: 20, pontoReposicao: 30, severity: 'CRITICAL' },
    ],
  },
  urgentPurchases: {
    totalValue: 15000,
    orderCount: 4,
    topSuppliers: [
      { fornecedorNome: 'Fornecedor A', totalPedidos: 3, valorTotal: 12000 },
    ],
  },
  capacity: {
    overloadedCenters: [
      { centroTrabalho: 'Linha 1', utilizacaoPct: 115, status: 'OVERLOADED' },
    ],
    totalOverloadAlerts: 1,
  },
  forecastAccuracy: {
    byClass: { A: 5.2, B: 8.7, C: 15.3 },
    weeklyTrend: [
      { weekLabel: 'Sem 1', classeA: 6.0, classeB: 9.0, classeC: 16.0 },
    ],
  },
  pipelineSummary: {
    stepsCompleted: 6,
    stepsFailed: 1,
    stepsSkipped: 0,
    durationMs: 45000,
  },
};

const EMPTY_DATA: DailySummaryData = {
  date: 'quarta-feira, 26/02/2026',
  stockAlerts: { belowSafetyStock: 0, approachingRop: 0, criticalSkus: [] },
  urgentPurchases: { totalValue: 0, orderCount: 0, topSuppliers: [] },
  capacity: { overloadedCenters: [], totalOverloadAlerts: 0 },
  forecastAccuracy: { byClass: {}, weeklyTrend: [] },
  pipelineSummary: null,
};

describe('Email Templates', () => {
  describe('buildSummaryHtml', () => {
    it('should produce valid HTML for RESUMO_DIARIO with data', () => {
      const html = buildSummaryHtml(MOCK_DATA, 'RESUMO_DIARIO');

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Resumo Diario');
      expect(html).toContain('26/02/2026');
      expect(html).toContain('Alertas de Estoque');
      expect(html).toContain('SKU-001');
      expect(html).toContain('Compras Urgentes');
      expect(html).toContain('Fornecedor A');
      expect(html).toContain('Capacidade');
      expect(html).toContain('Linha 1');
      expect(html).toContain('Acuracia de Forecast');
      expect(html).toContain('Pipeline Diario');
    });

    it('should produce valid HTML for BRIEFING_MATINAL', () => {
      const html = buildSummaryHtml(MOCK_DATA, 'BRIEFING_MATINAL');

      expect(html).toContain('Briefing Matinal');
      expect(html).toContain('26/02/2026');
    });

    it('should show fallback when no data available', () => {
      const html = buildSummaryHtml(EMPTY_DATA, 'RESUMO_DIARIO');

      expect(html).toContain('Nenhum dado disponivel');
      expect(html).not.toContain('Alertas de Estoque');
    });

    it('should skip sections conditionally', () => {
      const partial: DailySummaryData = {
        ...EMPTY_DATA,
        stockAlerts: { belowSafetyStock: 1, approachingRop: 0, criticalSkus: [] },
      };
      const html = buildSummaryHtml(partial, 'RESUMO_DIARIO');

      expect(html).toContain('Alertas de Estoque');
      expect(html).not.toContain('Compras Urgentes');
      expect(html).not.toContain('Capacidade');
    });
  });

  describe('buildSummaryText', () => {
    it('should produce plain text for RESUMO_DIARIO with data', () => {
      const text = buildSummaryText(MOCK_DATA, 'RESUMO_DIARIO');

      expect(text).toContain('RESUMO DIARIO');
      expect(text).toContain('ALERTAS DE ESTOQUE');
      expect(text).toContain('Abaixo do ES: 2');
      expect(text).toContain('COMPRAS URGENTES');
      expect(text).toContain('CAPACIDADE');
      expect(text).toContain('ACURACIA DE FORECAST');
      expect(text).toContain('PIPELINE DIARIO');
      expect(text).toContain('Completos: 6');
    });

    it('should produce plain text for BRIEFING_MATINAL', () => {
      const text = buildSummaryText(MOCK_DATA, 'BRIEFING_MATINAL');

      expect(text).toContain('BRIEFING MATINAL');
    });

    it('should skip empty sections in text', () => {
      const text = buildSummaryText(EMPTY_DATA, 'RESUMO_DIARIO');

      expect(text).not.toContain('ALERTAS DE ESTOQUE');
      expect(text).not.toContain('COMPRAS URGENTES');
      expect(text).toContain('gerado automaticamente');
    });
  });
});
