import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

const TEMPLATE_COLUMNS = [
  { header: 'codigo', key: 'codigo', width: 15 },
  { header: 'descricao', key: 'descricao', width: 30 },
  { header: 'tipo_produto', key: 'tipoProduto', width: 18 },
  { header: 'categoria_id', key: 'categoriaId', width: 38 },
  { header: 'unidade_medida_id', key: 'unidadeMedidaId', width: 38 },
  { header: 'peso_liquido_kg', key: 'pesoLiquidoKg', width: 16 },
  { header: 'volume_m3', key: 'volumeM3', width: 12 },
  { header: 'ativo', key: 'ativo', width: 8 },
  { header: 'custo_unitario', key: 'custoUnitario', width: 15 },
  { header: 'custo_pedido', key: 'custoPedido', width: 13 },
  { header: 'custo_manutencao_pct_ano', key: 'custoManutencaoPctAno', width: 24 },
  { header: 'preco_venda', key: 'precoVenda', width: 12 },
  { header: 'politica_ressuprimento', key: 'politicaRessuprimento', width: 22 },
  { header: 'intervalo_revisao_dias', key: 'intervaloRevisaoDias', width: 22 },
  { header: 'lote_minimo', key: 'loteMinimo', width: 12 },
  { header: 'multiplo_compra', key: 'multiploCompra', width: 16 },
  { header: 'estoque_seguranca_manual', key: 'estoqueSegurancaManual', width: 24 },
  { header: 'lead_time_producao_dias', key: 'leadTimeProducaoDias', width: 23 },
];

const SAMPLE_ROWS = [
  {
    codigo: 'SKU-001',
    descricao: 'Produto Acabado Exemplo',
    tipoProduto: 'ACABADO',
    categoriaId: '',
    unidadeMedidaId: '',
    pesoLiquidoKg: 1.5,
    volumeM3: 0.002,
    ativo: true,
    custoUnitario: 25.5,
    custoPedido: 150,
    custoManutencaoPctAno: 25,
    precoVenda: 89.9,
    politicaRessuprimento: 'PONTO_PEDIDO',
    intervaloRevisaoDias: '',
    loteMinimo: 1,
    multiploCompra: 1,
    estoqueSegurancaManual: '',
    leadTimeProducaoDias: 5,
  },
  {
    codigo: 'MP-001',
    descricao: 'Materia Prima Exemplo',
    tipoProduto: 'MATERIA_PRIMA',
    categoriaId: '',
    unidadeMedidaId: '',
    pesoLiquidoKg: 10,
    volumeM3: 0.01,
    ativo: true,
    custoUnitario: 5.0,
    custoPedido: 200,
    custoManutencaoPctAno: 20,
    precoVenda: '',
    politicaRessuprimento: 'MIN_MAX',
    intervaloRevisaoDias: '',
    loteMinimo: 100,
    multiploCompra: 50,
    estoqueSegurancaManual: 500,
    leadTimeProducaoDias: 14,
  },
];

@Injectable()
export class ImportTemplateService {
  async generateTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Produtos');

    sheet.columns = TEMPLATE_COLUMNS;

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    // Add sample rows
    for (const row of SAMPLE_ROWS) {
      sheet.addRow(row);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
