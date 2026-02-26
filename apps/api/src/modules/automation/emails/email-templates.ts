import type {
  DailySummaryData,
  EmailType,
  SkuAlert,
  SupplierSummary,
  CapacitySummary,
} from './daily-summary.types';

/**
 * Email template builders — TypeScript functions that produce HTML + text.
 *
 * No external template engine: type-safe, inlined HTML.
 * Sections render conditionally (skip if no data).
 *
 * @see Story 4.7 — AC-9, AC-10, AC-13, AC-14, AC-15
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ────────────────────────────────────────────────────────────────
// HTML Template
// ────────────────────────────────────────────────────────────────

export function buildSummaryHtml(data: DailySummaryData, tipo: EmailType): string {
  const title = tipo === 'BRIEFING_MATINAL'
    ? `Briefing Matinal — ${data.date}`
    : `Resumo Diario — ${data.date}`;

  const sections: string[] = [];

  // Stock Alerts (AC-3)
  if (data.stockAlerts.belowSafetyStock > 0 || data.stockAlerts.approachingRop > 0) {
    sections.push(buildStockAlertsHtml(data.stockAlerts));
  }

  // Urgent Purchases (AC-4)
  if (data.urgentPurchases.orderCount > 0) {
    sections.push(buildPurchasesHtml(data.urgentPurchases));
  }

  // Capacity (AC-5)
  if (data.capacity.overloadedCenters.length > 0) {
    sections.push(buildCapacityHtml(data.capacity));
  }

  // Forecast Accuracy (AC-6)
  if (Object.keys(data.forecastAccuracy.byClass).length > 0) {
    sections.push(buildAccuracyHtml(data.forecastAccuracy));
  }

  // Pipeline Summary (AC-8)
  if (data.pipelineSummary) {
    sections.push(buildPipelineSummaryHtml(data.pipelineSummary));
  }

  // No data fallback
  if (sections.length === 0) {
    sections.push(`<div style="padding: 16px; color: #6b7280;">Nenhum dado disponivel para este resumo.</div>`);
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 640px; margin: 0 auto; padding: 24px;">
    <div style="background-color: #1e40af; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 600;">${title}</h1>
      <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.85;">ForecastingMRP — Relatorio Automatico</p>
    </div>
    <div style="background-color: white; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
      ${sections.join('\n<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">\n')}
    </div>
    <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 16px;">
      Este email foi gerado automaticamente pelo ForecastingMRP. Nao responda.
    </p>
  </div>
</body>
</html>`;
}

function buildStockAlertsHtml(alerts: DailySummaryData['stockAlerts']): string {
  const rows = alerts.criticalSkus
    .map((s: SkuAlert) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${escapeHtml(s.codigo)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${escapeHtml(s.descricao)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right; color: ${s.severity === 'CRITICAL' ? '#dc2626' : '#d97706'};">${s.estoqueAtual}</td>
        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right;">${s.estoqueSeguranca}</td>
      </tr>`)
    .join('');

  return `
    <div>
      <h2 style="font-size: 16px; color: #111827; margin: 0 0 12px;">Alertas de Estoque</h2>
      <div style="display: flex; gap: 16px; margin-bottom: 12px;">
        <div style="background: #fef2f2; padding: 12px; border-radius: 6px; flex: 1;">
          <div style="font-size: 24px; font-weight: 700; color: #dc2626;">${alerts.belowSafetyStock}</div>
          <div style="font-size: 12px; color: #991b1b;">Abaixo do ES</div>
        </div>
        <div style="background: #fffbeb; padding: 12px; border-radius: 6px; flex: 1;">
          <div style="font-size: 24px; font-weight: 700; color: #d97706;">${alerts.approachingRop}</div>
          <div style="font-size: 12px; color: #92400e;">Proximo do PR</div>
        </div>
      </div>
      ${alerts.criticalSkus.length > 0 ? `
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 8px; text-align: left; font-size: 12px; color: #6b7280;">SKU</th>
            <th style="padding: 8px; text-align: left; font-size: 12px; color: #6b7280;">Produto</th>
            <th style="padding: 8px; text-align: right; font-size: 12px; color: #6b7280;">Estoque</th>
            <th style="padding: 8px; text-align: right; font-size: 12px; color: #6b7280;">ES</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>` : ''}
    </div>`;
}

function buildPurchasesHtml(purchases: DailySummaryData['urgentPurchases']): string {
  const supplierRows = purchases.topSuppliers
    .map((s: SupplierSummary) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${escapeHtml(s.fornecedorNome)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right;">${s.totalPedidos}</td>
        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right;">R$ ${s.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      </tr>`)
    .join('');

  return `
    <div>
      <h2 style="font-size: 16px; color: #111827; margin: 0 0 12px;">Compras Urgentes (Proximos 7 dias)</h2>
      <div style="display: flex; gap: 16px; margin-bottom: 12px;">
        <div style="background: #eff6ff; padding: 12px; border-radius: 6px; flex: 1;">
          <div style="font-size: 24px; font-weight: 700; color: #1e40af;">${purchases.orderCount}</div>
          <div style="font-size: 12px; color: #1e3a5f;">Pedidos</div>
        </div>
        <div style="background: #eff6ff; padding: 12px; border-radius: 6px; flex: 1;">
          <div style="font-size: 20px; font-weight: 700; color: #1e40af;">R$ ${purchases.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          <div style="font-size: 12px; color: #1e3a5f;">Valor Total</div>
        </div>
      </div>
      ${purchases.topSuppliers.length > 0 ? `
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 8px; text-align: left; font-size: 12px; color: #6b7280;">Fornecedor</th>
            <th style="padding: 8px; text-align: right; font-size: 12px; color: #6b7280;">Pedidos</th>
            <th style="padding: 8px; text-align: right; font-size: 12px; color: #6b7280;">Valor</th>
          </tr>
        </thead>
        <tbody>${supplierRows}</tbody>
      </table>` : ''}
    </div>`;
}

function buildCapacityHtml(capacity: DailySummaryData['capacity']): string {
  const rows = capacity.overloadedCenters
    .map((c: CapacitySummary) => {
      const color = c.status === 'OVERLOADED' ? '#dc2626' : c.status === 'WARNING' ? '#d97706' : '#059669';
      return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${escapeHtml(c.centroTrabalho)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right; color: ${color}; font-weight: 600;">${c.utilizacaoPct.toFixed(1)}%</td>
      </tr>`;
    })
    .join('');

  return `
    <div>
      <h2 style="font-size: 16px; color: #111827; margin: 0 0 12px;">Capacidade</h2>
      <div style="background: ${capacity.totalOverloadAlerts > 0 ? '#fef2f2' : '#f0fdf4'}; padding: 12px; border-radius: 6px; margin-bottom: 12px;">
        <div style="font-size: 24px; font-weight: 700; color: ${capacity.totalOverloadAlerts > 0 ? '#dc2626' : '#059669'};">${capacity.totalOverloadAlerts}</div>
        <div style="font-size: 12px; color: #374151;">Alertas de Sobrecarga</div>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 8px; text-align: left; font-size: 12px; color: #6b7280;">Centro de Trabalho</th>
            <th style="padding: 8px; text-align: right; font-size: 12px; color: #6b7280;">Utilizacao</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function buildAccuracyHtml(accuracy: DailySummaryData['forecastAccuracy']): string {
  const classEntries = Object.entries(accuracy.byClass)
    .map(([cls, mape]) => `
      <div style="background: #f0fdf4; padding: 12px; border-radius: 6px; flex: 1; text-align: center;">
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Classe ${cls}</div>
        <div style="font-size: 20px; font-weight: 700; color: #059669;">${mape !== null ? `${mape}%` : 'N/A'}</div>
        <div style="font-size: 11px; color: #9ca3af;">MAPE</div>
      </div>`)
    .join('');

  return `
    <div>
      <h2 style="font-size: 16px; color: #111827; margin: 0 0 12px;">Acuracia de Forecast</h2>
      <div style="display: flex; gap: 12px; margin-bottom: 12px;">${classEntries}</div>
    </div>`;
}

function buildPipelineSummaryHtml(summary: NonNullable<DailySummaryData['pipelineSummary']>): string {
  const durationStr = summary.durationMs < 1000
    ? `${summary.durationMs}ms`
    : summary.durationMs < 60000
      ? `${Math.floor(summary.durationMs / 1000)}s`
      : `${Math.floor(summary.durationMs / 60000)}m ${Math.floor((summary.durationMs % 60000) / 1000)}s`;

  return `
    <div>
      <h2 style="font-size: 16px; color: #111827; margin: 0 0 12px;">Pipeline Diario</h2>
      <div style="display: flex; gap: 12px;">
        <div style="background: #f0fdf4; padding: 12px; border-radius: 6px; flex: 1; text-align: center;">
          <div style="font-size: 20px; font-weight: 700; color: #059669;">${summary.stepsCompleted}</div>
          <div style="font-size: 11px; color: #6b7280;">Completos</div>
        </div>
        <div style="background: ${summary.stepsFailed > 0 ? '#fef2f2' : '#f9fafb'}; padding: 12px; border-radius: 6px; flex: 1; text-align: center;">
          <div style="font-size: 20px; font-weight: 700; color: ${summary.stepsFailed > 0 ? '#dc2626' : '#6b7280'};">${summary.stepsFailed}</div>
          <div style="font-size: 11px; color: #6b7280;">Falhas</div>
        </div>
        <div style="background: #f9fafb; padding: 12px; border-radius: 6px; flex: 1; text-align: center;">
          <div style="font-size: 20px; font-weight: 700; color: #6b7280;">${summary.stepsSkipped}</div>
          <div style="font-size: 11px; color: #6b7280;">Ignorados</div>
        </div>
        <div style="background: #f9fafb; padding: 12px; border-radius: 6px; flex: 1; text-align: center;">
          <div style="font-size: 20px; font-weight: 700; color: #374151;">${durationStr}</div>
          <div style="font-size: 11px; color: #6b7280;">Duracao</div>
        </div>
      </div>
    </div>`;
}

// ────────────────────────────────────────────────────────────────
// Plain Text Template (AC-10)
// ────────────────────────────────────────────────────────────────

export function buildSummaryText(data: DailySummaryData, tipo: EmailType): string {
  const title = tipo === 'BRIEFING_MATINAL'
    ? `BRIEFING MATINAL — ${data.date}`
    : `RESUMO DIARIO — ${data.date}`;

  const lines: string[] = [title, '='.repeat(title.length), ''];

  // Stock Alerts
  if (data.stockAlerts.belowSafetyStock > 0 || data.stockAlerts.approachingRop > 0) {
    lines.push('ALERTAS DE ESTOQUE');
    lines.push(`  Abaixo do ES: ${data.stockAlerts.belowSafetyStock}`);
    lines.push(`  Proximo do PR: ${data.stockAlerts.approachingRop}`);
    for (const s of data.stockAlerts.criticalSkus) {
      lines.push(`  [${s.severity}] ${s.codigo} — ${s.descricao} (Estoque: ${s.estoqueAtual}, ES: ${s.estoqueSeguranca})`);
    }
    lines.push('');
  }

  // Urgent Purchases
  if (data.urgentPurchases.orderCount > 0) {
    lines.push('COMPRAS URGENTES (7 dias)');
    lines.push(`  Pedidos: ${data.urgentPurchases.orderCount}`);
    lines.push(`  Valor Total: R$ ${data.urgentPurchases.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    for (const s of data.urgentPurchases.topSuppliers) {
      lines.push(`  ${s.fornecedorNome}: ${s.totalPedidos} pedidos (R$ ${s.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
    }
    lines.push('');
  }

  // Capacity
  if (data.capacity.overloadedCenters.length > 0) {
    lines.push('CAPACIDADE');
    lines.push(`  Alertas de Sobrecarga: ${data.capacity.totalOverloadAlerts}`);
    for (const c of data.capacity.overloadedCenters) {
      lines.push(`  ${c.centroTrabalho}: ${c.utilizacaoPct.toFixed(1)}% [${c.status}]`);
    }
    lines.push('');
  }

  // Forecast Accuracy
  if (Object.keys(data.forecastAccuracy.byClass).length > 0) {
    lines.push('ACURACIA DE FORECAST (MAPE)');
    for (const [cls, mape] of Object.entries(data.forecastAccuracy.byClass)) {
      lines.push(`  Classe ${cls}: ${mape !== null ? `${mape}%` : 'N/A'}`);
    }
    lines.push('');
  }

  // Pipeline Summary
  if (data.pipelineSummary) {
    lines.push('PIPELINE DIARIO');
    lines.push(`  Completos: ${data.pipelineSummary.stepsCompleted}`);
    lines.push(`  Falhas: ${data.pipelineSummary.stepsFailed}`);
    lines.push(`  Ignorados: ${data.pipelineSummary.stepsSkipped}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('Este email foi gerado automaticamente pelo ForecastingMRP.');

  return lines.join('\n');
}
