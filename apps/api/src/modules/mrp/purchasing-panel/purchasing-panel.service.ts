import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { ExcelExportService } from './excel-export.service';
import type {
  PurchasingPanelResponse,
  UrgentAction,
  SupplierSummary,
  CompraOrderSummary,
  PurchaseTotals,
  EmailSummaryResult,
} from './interfaces/purchasing-panel.interface';

/**
 * PurchasingPanelService — Purchasing Panel Data Provider
 *
 * Provides purchasing panel data for a given MRP execution:
 * - Urgent actions (COMPRA orders due within 7 days)
 * - Summary grouped by supplier
 * - Aggregate purchase totals
 * - Excel export
 * - Email summary (placeholder)
 *
 * All return values use immutable interfaces (readonly properties).
 *
 * @see Story 3.11 — Purchasing Panel (AC-1 through AC-7)
 */
@Injectable()
export class PurchasingPanelService {
  private readonly logger = new Logger(PurchasingPanelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly excelExportService: ExcelExportService,
  ) {}

  /**
   * Load full purchasing panel data for a given execution.
   *
   * @param execucaoId - MRP execution UUID
   * @returns Structured panel data with urgent actions, supplier summary, and totals
   * @throws NotFoundException if execution does not exist
   */
  async getPanelData(execucaoId: string): Promise<PurchasingPanelResponse> {
    // Verify execution exists
    const execution = await this.prisma.execucaoPlanejamento.findUnique({
      where: { id: execucaoId },
      select: { id: true },
    });

    if (execution === null) {
      throw new NotFoundException(
        `Execution with id ${execucaoId} not found`,
      );
    }

    // Load all COMPRA orders for this execution with product and supplier joins
    const orders = await this.prisma.ordemPlanejada.findMany({
      where: { execucaoId, tipo: 'COMPRA' },
      include: {
        produto: { select: { codigo: true, descricao: true } },
        fornecedor: {
          select: { id: true, razaoSocial: true, leadTimePadraoDias: true },
        },
      },
      orderBy: { dataLiberacao: 'asc' },
    });

    // Build urgent actions: orders with dataLiberacao within the next 7 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const urgentActions: UrgentAction[] = orders
      .filter((order) => {
        const releaseDate = new Date(order.dataLiberacao);
        releaseDate.setHours(0, 0, 0, 0);
        return releaseDate >= today && releaseDate <= sevenDaysFromNow;
      })
      .map((order) => ({
        orderId: order.id,
        produtoCodigo: order.produto.codigo,
        produtoDescricao: order.produto.descricao,
        quantidade: Number(order.quantidade),
        fornecedorNome: order.fornecedor?.razaoSocial ?? 'Sem fornecedor',
        fornecedorId: order.fornecedorId,
        dataLiberacao: order.dataLiberacao.toISOString().split('T')[0],
        dataNecessidade: order.dataNecessidade.toISOString().split('T')[0],
        custoEstimado: Number(order.custoEstimado ?? 0),
        prioridade: order.prioridade as UrgentAction['prioridade'],
        mensagemAcao: order.mensagemAcao,
      }));

    // Build supplier summary: group by fornecedorId
    const supplierMap = new Map<
      string,
      {
        fornecedorId: string;
        fornecedorNome: string;
        orders: CompraOrderSummary[];
        totalQuantidade: number;
        totalCusto: number;
      }
    >();

    for (const order of orders) {
      const supplierId = order.fornecedorId ?? 'SEM_FORNECEDOR';
      const supplierName =
        order.fornecedor?.razaoSocial ?? 'Sem fornecedor';

      const existing = supplierMap.get(supplierId);
      const orderSummary: CompraOrderSummary = {
        orderId: order.id,
        produtoCodigo: order.produto.codigo,
        produtoDescricao: order.produto.descricao,
        quantidade: Number(order.quantidade),
        custoEstimado: Number(order.custoEstimado ?? 0),
        dataLiberacao: order.dataLiberacao.toISOString().split('T')[0],
        prioridade: order.prioridade,
      };

      if (existing !== undefined) {
        supplierMap.set(supplierId, {
          ...existing,
          orders: [...existing.orders, orderSummary],
          totalQuantidade:
            existing.totalQuantidade + Number(order.quantidade),
          totalCusto:
            existing.totalCusto + Number(order.custoEstimado ?? 0),
        });
      } else {
        supplierMap.set(supplierId, {
          fornecedorId: supplierId,
          fornecedorNome: supplierName,
          orders: [orderSummary],
          totalQuantidade: Number(order.quantidade),
          totalCusto: Number(order.custoEstimado ?? 0),
        });
      }
    }

    const supplierSummary: SupplierSummary[] = [...supplierMap.values()].map(
      (entry) => ({
        fornecedorId: entry.fornecedorId,
        fornecedorNome: entry.fornecedorNome,
        totalOrders: entry.orders.length,
        totalQuantidade: entry.totalQuantidade,
        totalCusto: entry.totalCusto,
        orders: entry.orders,
      }),
    );

    // Build totals
    const totalPurchaseCost = orders.reduce(
      (sum, order) => sum + Number(order.custoEstimado ?? 0),
      0,
    );

    const leadTimes = orders
      .filter((order) => order.fornecedor?.leadTimePadraoDias != null)
      .map((order) => order.fornecedor!.leadTimePadraoDias!);

    const averageLeadTimeDays =
      leadTimes.length > 0
        ? Math.round(
            (leadTimes.reduce((sum, lt) => sum + lt, 0) / leadTimes.length) *
              10,
          ) / 10
        : 0;

    const totals: PurchaseTotals = {
      totalPurchaseCost,
      totalOrders: orders.length,
      urgentOrders: urgentActions.length,
      averageLeadTimeDays,
    };

    return {
      execucaoId,
      generatedAt: new Date().toISOString(),
      urgentActions,
      supplierSummary,
      totals,
    };
  }

  /**
   * Generate Excel export buffer for a purchasing panel.
   *
   * @param execucaoId - MRP execution UUID
   * @returns Excel workbook buffer
   */
  async getExportData(execucaoId: string): Promise<Buffer> {
    const panelData = await this.getPanelData(execucaoId);
    return this.excelExportService.generatePurchasingReport(panelData);
  }

  /**
   * Send email summary for a purchasing panel (placeholder).
   *
   * Currently logs the email content and returns success.
   * In production, this would use nodemailer or AWS SES.
   *
   * @param execucaoId - MRP execution UUID
   * @returns Email send result with recipients
   */
  async sendEmailSummary(execucaoId: string): Promise<EmailSummaryResult> {
    const panelData = await this.getPanelData(execucaoId);

    // Load email recipients from config
    let recipients: string[] = [];
    try {
      const config = await this.prisma.configSistema.findUnique({
        where: { chave: 'mrp.purchasing_email_recipients' },
      });
      if (config?.valor != null) {
        const parsed = config.valor as unknown;
        if (Array.isArray(parsed)) {
          recipients = parsed.filter(
            (r): r is string => typeof r === 'string',
          );
        }
      }
    } catch {
      this.logger.warn(
        'Could not load purchasing email recipients from config',
      );
    }

    if (recipients.length === 0) {
      recipients = ['compras@empresa.com'];
    }

    // Build summary text
    const topSuppliers = [...panelData.supplierSummary]
      .sort((a, b) => b.totalCusto - a.totalCusto)
      .slice(0, 5);

    const summaryText = [
      `Resumo do Painel de Compras — Execução ${execucaoId.slice(0, 8)}`,
      `Gerado em: ${panelData.generatedAt}`,
      '',
      `Total de ordens: ${panelData.totals.totalOrders}`,
      `Ordens urgentes: ${panelData.totals.urgentOrders}`,
      `Custo total estimado: R$ ${panelData.totals.totalPurchaseCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `Lead time médio: ${panelData.totals.averageLeadTimeDays} dias`,
      '',
      'Top 5 fornecedores por custo:',
      ...topSuppliers.map(
        (s, i) =>
          `  ${i + 1}. ${s.fornecedorNome} — R$ ${s.totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${s.totalOrders} ordens)`,
      ),
    ].join('\n');

    // Placeholder: log the email instead of sending
    this.logger.log(
      `[EMAIL PLACEHOLDER] Would send to: ${recipients.join(', ')}`,
    );
    this.logger.log(`[EMAIL PLACEHOLDER] Content:\n${summaryText}`);

    return {
      sent: true,
      recipients,
    };
  }
}
