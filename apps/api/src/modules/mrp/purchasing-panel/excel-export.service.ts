import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

import type {
  PurchasingPanelResponse,
  UrgentAction,
  SupplierSummary,
} from './interfaces/purchasing-panel.interface';

/**
 * Header column definition for Excel worksheets.
 */
interface HeaderColumn {
  readonly header: string;
  readonly key: string;
  readonly width: number;
  readonly style?: Partial<ExcelJS.Style>;
}

/** BRL currency number format for Excel cells. */
const BRL_NUMBER_FORMAT = '#,##0.00;[Red]-#,##0.00';

/**
 * ExcelExportService — Purchasing Panel Excel Generator
 *
 * Generates a 3-sheet Excel workbook:
 * - Sheet 1 "Ações Urgentes": urgent orders (next 7 days)
 * - Sheet 2 "Por Fornecedor": grouped by supplier with subtotals
 * - Sheet 3 "Todas as Ordens": complete COMPRA order list
 *
 * @see Story 3.11 — Purchasing Panel (AC-6)
 */
@Injectable()
export class ExcelExportService {
  /**
   * Generate the full purchasing report as an Excel buffer.
   *
   * @param panelData - Complete purchasing panel response data
   * @returns Buffer containing the xlsx workbook
   */
  async generatePurchasingReport(
    panelData: PurchasingPanelResponse,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ForecastingMRP';
    workbook.created = new Date();

    this.addUrgentActionsSheet(workbook, panelData.urgentActions);
    this.addSupplierSummarySheet(workbook, panelData.supplierSummary);
    this.addAllOrdersSheet(workbook, panelData.supplierSummary);

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Sheet 1: Urgent Actions — orders with release date within 7 days.
   */
  private addUrgentActionsSheet(
    workbook: ExcelJS.Workbook,
    urgentActions: readonly UrgentAction[],
  ): void {
    const sheet = workbook.addWorksheet('Ações Urgentes');

    const columns: HeaderColumn[] = [
      { header: 'ID Ordem', key: 'orderId', width: 20 },
      { header: 'Código SKU', key: 'produtoCodigo', width: 15 },
      { header: 'Descrição', key: 'produtoDescricao', width: 35 },
      { header: 'Quantidade', key: 'quantidade', width: 14 },
      { header: 'Fornecedor', key: 'fornecedorNome', width: 30 },
      { header: 'Data Liberação', key: 'dataLiberacao', width: 16 },
      { header: 'Data Necessidade', key: 'dataNecessidade', width: 16 },
      {
        header: 'Custo Estimado (R$)',
        key: 'custoEstimado',
        width: 20,
        style: { numFmt: BRL_NUMBER_FORMAT },
      },
      { header: 'Prioridade', key: 'prioridade', width: 12 },
      { header: 'Mensagem Ação', key: 'mensagemAcao', width: 30 },
    ];

    sheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width,
      style: col.style,
    }));

    this.styleHeaderRow(sheet);

    for (const action of urgentActions) {
      sheet.addRow({
        orderId: action.orderId,
        produtoCodigo: action.produtoCodigo,
        produtoDescricao: action.produtoDescricao,
        quantidade: action.quantidade,
        fornecedorNome: action.fornecedorNome,
        dataLiberacao: action.dataLiberacao,
        dataNecessidade: action.dataNecessidade,
        custoEstimado: action.custoEstimado,
        prioridade: action.prioridade,
        mensagemAcao: action.mensagemAcao ?? '',
      });
    }
  }

  /**
   * Sheet 2: Summary by Supplier with subtotals per supplier.
   */
  private addSupplierSummarySheet(
    workbook: ExcelJS.Workbook,
    supplierSummary: readonly SupplierSummary[],
  ): void {
    const sheet = workbook.addWorksheet('Por Fornecedor');

    const columns: HeaderColumn[] = [
      { header: 'Fornecedor', key: 'fornecedorNome', width: 35 },
      { header: 'Total Ordens', key: 'totalOrders', width: 14 },
      { header: 'Total Quantidade', key: 'totalQuantidade', width: 18 },
      {
        header: 'Total Custo (R$)',
        key: 'totalCusto',
        width: 20,
        style: { numFmt: BRL_NUMBER_FORMAT },
      },
    ];

    sheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width,
      style: col.style,
    }));

    this.styleHeaderRow(sheet);

    for (const supplier of supplierSummary) {
      const row = sheet.addRow({
        fornecedorNome: supplier.fornecedorNome,
        totalOrders: supplier.totalOrders,
        totalQuantidade: supplier.totalQuantidade,
        totalCusto: supplier.totalCusto,
      });
      row.font = { bold: true };
    }
  }

  /**
   * Sheet 3: All Orders — complete list of COMPRA orders.
   */
  private addAllOrdersSheet(
    workbook: ExcelJS.Workbook,
    supplierSummary: readonly SupplierSummary[],
  ): void {
    const sheet = workbook.addWorksheet('Todas as Ordens');

    const columns: HeaderColumn[] = [
      { header: 'ID Ordem', key: 'orderId', width: 20 },
      { header: 'Código SKU', key: 'produtoCodigo', width: 15 },
      { header: 'Descrição', key: 'produtoDescricao', width: 35 },
      { header: 'Quantidade', key: 'quantidade', width: 14 },
      {
        header: 'Custo Estimado (R$)',
        key: 'custoEstimado',
        width: 20,
        style: { numFmt: BRL_NUMBER_FORMAT },
      },
      { header: 'Data Liberação', key: 'dataLiberacao', width: 16 },
      { header: 'Prioridade', key: 'prioridade', width: 12 },
      { header: 'Fornecedor', key: 'fornecedorNome', width: 30 },
    ];

    sheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width,
      style: col.style,
    }));

    this.styleHeaderRow(sheet);

    for (const supplier of supplierSummary) {
      for (const order of supplier.orders) {
        sheet.addRow({
          orderId: order.orderId,
          produtoCodigo: order.produtoCodigo,
          produtoDescricao: order.produtoDescricao,
          quantidade: order.quantidade,
          custoEstimado: order.custoEstimado,
          dataLiberacao: order.dataLiberacao,
          prioridade: order.prioridade,
          fornecedorNome: supplier.fornecedorNome,
        });
      }
    }
  }

  /**
   * Apply bold + background styling to the header row (row 1).
   */
  private styleHeaderRow(sheet: ExcelJS.Worksheet): void {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;
  }
}
