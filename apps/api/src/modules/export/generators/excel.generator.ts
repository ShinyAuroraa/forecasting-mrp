import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ExportType } from '../export.types';

/**
 * Excel file generator for all export types.
 * Reuses ExcelJS patterns from Story 3.11.
 *
 * @see Story 4.10 — AC-1 to AC-6
 */
@Injectable()
export class ExcelGeneratorService {
  private readonly logger = new Logger(ExcelGeneratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generate(type: ExportType, filters: Record<string, unknown>): Promise<Buffer> {
    switch (type) {
      case 'MRP_ORDERS':
        return this.generateMrpOrders(filters);
      case 'PURCHASING_PANEL':
        return this.generatePurchasingPanel(filters);
      case 'FORECAST_DATA':
        return this.generateForecastData(filters);
      case 'CAPACITY':
        return this.generateCapacity(filters);
      case 'STOCK_PARAMS':
        return this.generateStockParams(filters);
      case 'EXECUTIVE_DASHBOARD':
        return this.generateDashboardKpis(filters);
      case 'MRP_SUMMARY':
        return this.generateMrpOrders(filters);
      default:
        throw new Error(`Unsupported Excel export type: ${type}`);
    }
  }

  /** Count total rows for async decision (AC-11) */
  async countRows(type: ExportType, filters: Record<string, unknown>): Promise<number> {
    switch (type) {
      case 'MRP_ORDERS':
        return this.prisma.ordemPlanejada.count({ where: this.buildOrderFilters(filters) });
      case 'FORECAST_DATA':
        return this.prisma.forecastResultado.count();
      case 'CAPACITY':
        return this.prisma.eventoCapacidade.count();
      case 'STOCK_PARAMS':
        return this.prisma.parametrosEstoque.count();
      default:
        return 0;
    }
  }

  // ── AC-1: MRP Planned Orders ──────────────────────────

  private async generateMrpOrders(filters: Record<string, unknown>): Promise<Buffer> {
    const orders = await this.prisma.ordemPlanejada.findMany({
      where: this.buildOrderFilters(filters),
      include: { produto: { select: { codigo: true, descricao: true } } },
      orderBy: { dataLiberacao: 'asc' } as any,
      take: 10000,
    });

    const workbook = this.createWorkbook();
    const sheet = workbook.addWorksheet('Ordens Planejadas');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Produto', key: 'produto', width: 20 },
      { header: 'Descrição', key: 'descricao', width: 30 },
      { header: 'Tipo', key: 'tipo', width: 12 },
      { header: 'Quantidade', key: 'quantidade', width: 14, style: { numFmt: '#,##0' } },
      { header: 'Data Início', key: 'dataInicio', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
      { header: 'Data Fim', key: 'dataFim', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Custo Estimado', key: 'custo', width: 18, style: { numFmt: '#,##0.00' } },
    ];

    this.styleHeaderRow(sheet);

    for (const o of orders) {
      sheet.addRow({
        id: o.id,
        produto: (o as any).produto?.codigo ?? o.produtoId,
        descricao: (o as any).produto?.descricao ?? '',
        tipo: o.tipo,
        quantidade: Number(o.quantidade),
        dataInicio: (o as any).dataInicio ?? (o as any).dataLiberacao,
        dataFim: (o as any).dataFim ?? (o as any).dataNecessidade,
        status: o.status,
        custo: Number(o.custoEstimado ?? 0),
      });
    }

    return this.toBuffer(workbook);
  }

  // ── AC-2: Purchasing Panel ────────────────────────────

  private async generatePurchasingPanel(filters: Record<string, unknown>): Promise<Buffer> {
    const orders = await this.prisma.ordemPlanejada.findMany({
      where: { tipo: 'COMPRA', status: { not: 'CANCELADA' } },
      include: { produto: { select: { codigo: true, descricao: true } } },
      orderBy: { dataLiberacao: 'asc' } as any,
      take: 10000,
    });

    const workbook = this.createWorkbook();
    const sheet = workbook.addWorksheet('Painel de Compras');

    sheet.columns = [
      { header: 'Produto', key: 'produto', width: 20 },
      { header: 'Descrição', key: 'descricao', width: 30 },
      { header: 'Quantidade', key: 'quantidade', width: 14, style: { numFmt: '#,##0' } },
      { header: 'Data Necessidade', key: 'dataInicio', width: 16, style: { numFmt: 'dd/mm/yyyy' } },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Custo Estimado', key: 'custo', width: 18, style: { numFmt: '#,##0.00' } },
    ];

    this.styleHeaderRow(sheet);

    for (const o of orders) {
      sheet.addRow({
        produto: (o as any).produto?.codigo ?? o.produtoId,
        descricao: (o as any).produto?.descricao ?? '',
        quantidade: Number(o.quantidade),
        dataInicio: (o as any).dataInicio ?? (o as any).dataLiberacao,
        status: o.status,
        custo: Number(o.custoEstimado ?? 0),
      });
    }

    return this.toBuffer(workbook);
  }

  // ── AC-3: Forecast Data ───────────────────────────────

  private async generateForecastData(filters: Record<string, unknown>): Promise<Buffer> {
    const forecasts = await this.prisma.forecastResultado.findMany({
      orderBy: { periodo: 'asc' },
      take: 10000,
      select: {
        id: true,
        produtoId: true,
        periodo: true,
        targetType: true,
        p10: true,
        p50: true,
        p90: true,
        faturamentoP10: true,
        faturamentoP50: true,
        faturamentoP90: true,
      },
    });

    const workbook = this.createWorkbook();
    const sheet = workbook.addWorksheet('Forecast');

    sheet.columns = [
      { header: 'Produto ID', key: 'produtoId', width: 36 },
      { header: 'Período', key: 'periodo', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
      { header: 'Target', key: 'target', width: 14 },
      { header: 'P10', key: 'p10', width: 14, style: { numFmt: '#,##0.00' } },
      { header: 'P50', key: 'p50', width: 14, style: { numFmt: '#,##0.00' } },
      { header: 'P90', key: 'p90', width: 14, style: { numFmt: '#,##0.00' } },
    ];

    this.styleHeaderRow(sheet);

    for (const f of forecasts) {
      const isFat = f.targetType === 'FATURAMENTO';
      sheet.addRow({
        produtoId: f.produtoId,
        periodo: f.periodo,
        target: f.targetType,
        p10: Number(isFat ? f.faturamentoP10 : f.p10) || 0,
        p50: Number(isFat ? f.faturamentoP50 : f.p50) || 0,
        p90: Number(isFat ? f.faturamentoP90 : f.p90) || 0,
      });
    }

    return this.toBuffer(workbook);
  }

  // ── AC-4: Capacity Utilization ────────────────────────

  private async generateCapacity(filters: Record<string, unknown>): Promise<Buffer> {
    const events = await this.prisma.eventoCapacidade.findMany({
      orderBy: { dataEvento: 'desc' },
      take: 5000,
      include: { centroTrabalho: { select: { nome: true } } },
    });

    const workbook = this.createWorkbook();
    const sheet = workbook.addWorksheet('Capacidade');

    sheet.columns = [
      { header: 'Centro de Trabalho', key: 'centro', width: 25 },
      { header: 'Data Evento', key: 'data', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
      { header: 'Tipo', key: 'tipo', width: 14 },
      { header: 'Valor Anterior', key: 'anterior', width: 16, style: { numFmt: '#,##0.00' } },
      { header: 'Valor Novo', key: 'novo', width: 16, style: { numFmt: '#,##0.00' } },
      { header: 'Utilização %', key: 'utilizacao', width: 14, style: { numFmt: '#,##0.00' } },
    ];

    this.styleHeaderRow(sheet);

    for (const e of events) {
      const utilization = parseFloat(e.valorNovo ?? '0');
      const row = sheet.addRow({
        centro: (e as any).centroTrabalho?.nome ?? e.centroTrabalhoId,
        data: e.dataEvento,
        tipo: e.tipo,
        anterior: parseFloat(e.valorAnterior ?? '0'),
        novo: utilization,
        utilizacao: utilization,
      });

      // AC-4: Conditional formatting
      const cell = row.getCell('utilizacao');
      if (utilization > 110) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      } else if (utilization >= 80) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      }
    }

    return this.toBuffer(workbook);
  }

  // ── AC-5: Stock Parameters ────────────────────────────

  private async generateStockParams(filters: Record<string, unknown>): Promise<Buffer> {
    const params = await this.prisma.parametrosEstoque.findMany({
      include: { produto: { select: { codigo: true, descricao: true } } },
      take: 10000,
    });

    const workbook = this.createWorkbook();
    const sheet = workbook.addWorksheet('Parâmetros de Estoque');

    sheet.columns = [
      { header: 'Produto', key: 'produto', width: 20 },
      { header: 'Descrição', key: 'descricao', width: 30 },
      { header: 'Estoque Segurança', key: 'estoqueSeguranca', width: 18, style: { numFmt: '#,##0' } },
      { header: 'Ponto Reposição', key: 'pontoReposicao', width: 16, style: { numFmt: '#,##0' } },
      { header: 'Lead Time (dias)', key: 'leadTime', width: 16, style: { numFmt: '#,##0' } },
      { header: 'Lote Mínimo', key: 'loteMinimo', width: 14, style: { numFmt: '#,##0' } },
      { header: 'Lote Múltiplo', key: 'loteMultiplo', width: 14, style: { numFmt: '#,##0' } },
    ];

    this.styleHeaderRow(sheet);

    for (const p of params) {
      const pa = p as any;
      sheet.addRow({
        produto: pa.produto?.codigo ?? p.produtoId,
        descricao: pa.produto?.descricao ?? '',
        estoqueSeguranca: Number(pa.estoqueSeguranca ?? pa.safetyStock ?? 0),
        pontoReposicao: Number(pa.pontoReposicao ?? pa.reorderPoint ?? 0),
        leadTime: Number(pa.leadTimeDias ?? pa.leadTimeDiasBase ?? 0),
        loteMinimo: Number(pa.loteMinimo ?? pa.estoqueMinimo ?? 0),
        loteMultiplo: Number(pa.loteMultiplo ?? 0),
      });
    }

    return this.toBuffer(workbook);
  }

  // ── AC-6: Dashboard KPIs ──────────────────────────────

  private async generateDashboardKpis(filters: Record<string, unknown>): Promise<Buffer> {
    const [orderCount, totalValue, inventoryResult] = await Promise.all([
      this.prisma.ordemPlanejada.count({ where: { status: { not: 'CANCELADA' } } }),
      this.prisma.ordemPlanejada.aggregate({
        _sum: { custoEstimado: true },
        where: { status: { not: 'CANCELADA' } },
      }),
      this.prisma.$queryRaw<{ total: number | null }[]>`
        SELECT SUM(CAST(quantidade_disponivel AS NUMERIC) * COALESCE(CAST(custo_medio_unitario AS NUMERIC), 0)) AS total
        FROM inventario_atual
      `,
    ]);

    const workbook = this.createWorkbook();
    const sheet = workbook.addWorksheet('Dashboard Executivo');

    sheet.columns = [
      { header: 'KPI', key: 'kpi', width: 30 },
      { header: 'Valor', key: 'valor', width: 20, style: { numFmt: '#,##0.00' } },
    ];

    this.styleHeaderRow(sheet);

    sheet.addRow({ kpi: 'Total Ordens Planejadas', valor: orderCount });
    sheet.addRow({ kpi: 'Valor Total Ordens (R$)', valor: Number(totalValue._sum.custoEstimado ?? 0) });
    sheet.addRow({ kpi: 'Valor Inventário (R$)', valor: Number(inventoryResult[0]?.total ?? 0) });

    return this.toBuffer(workbook);
  }

  // ── Shared Utilities ──────────────────────────────────

  private createWorkbook(): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ForecastingMRP';
    workbook.created = new Date();
    return workbook;
  }

  private styleHeaderRow(sheet: ExcelJS.Worksheet): void {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;
  }

  private async toBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  private buildOrderFilters(filters: Record<string, unknown>): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.tipo) where.tipo = filters.tipo;
    return where;
  }
}
