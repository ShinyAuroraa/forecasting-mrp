import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../../prisma/prisma.service';
import { TipoProduto, PoliticaRessuprimento } from '../../../generated/prisma/client';

export interface ImportError {
  row: number;
  field: string;
  value: string;
  message: string;
}

export interface ImportResult {
  imported: number;
  rejected: number;
  errors: ImportError[];
}

interface RawRow {
  [key: string]: string | number | boolean | null | undefined;
}

const TIPO_PRODUTO_VALUES = new Set(Object.values(TipoProduto));
const POLITICA_VALUES = new Set(Object.values(PoliticaRessuprimento));

const COLUMN_MAP: Record<string, string> = {
  codigo: 'codigo',
  descricao: 'descricao',
  tipo_produto: 'tipoProduto',
  categoria_id: 'categoriaId',
  unidade_medida_id: 'unidadeMedidaId',
  peso_liquido_kg: 'pesoLiquidoKg',
  volume_m3: 'volumeM3',
  ativo: 'ativo',
  custo_unitario: 'custoUnitario',
  custo_pedido: 'custoPedido',
  custo_manutencao_pct_ano: 'custoManutencaoPctAno',
  preco_venda: 'precoVenda',
  politica_ressuprimento: 'politicaRessuprimento',
  intervalo_revisao_dias: 'intervaloRevisaoDias',
  lote_minimo: 'loteMinimo',
  multiplo_compra: 'multiploCompra',
  estoque_seguranca_manual: 'estoqueSegurancaManual',
  lead_time_producao_dias: 'leadTimeProducaoDias',
};

@Injectable()
export class ImportProdutosService {
  constructor(private readonly prisma: PrismaService) {}

  async processImport(file: Express.Multer.File): Promise<ImportResult> {
    const rows = await this.parseFile(file);

    if (rows.length === 0) {
      throw new BadRequestException('File contains no data rows');
    }

    const existingCodigos = new Set(
      (await this.prisma.produto.findMany({ select: { codigo: true } }))
        .map((p) => p.codigo),
    );

    const errors: ImportError[] = [];
    const validRows: Record<string, unknown>[] = [];
    const seenCodigos = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +2 because row 1 is headers, data starts at 2
      const raw = rows[i];
      const rowErrors = this.validateRow(raw, rowNumber, existingCodigos, seenCodigos);

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      } else {
        const mapped = this.mapRow(raw);
        validRows.push(mapped);
        seenCodigos.add(String(raw['codigo']).trim());
      }
    }

    let imported = 0;
    for (const data of validRows) {
      try {
        await this.prisma.produto.create({ data: data as any });
        imported++;
      } catch {
        errors.push({
          row: 0,
          field: 'database',
          value: String(data['codigo'] || ''),
          message: 'Failed to insert row into database',
        });
      }
    }

    return {
      imported,
      rejected: rows.length - imported,
      errors,
    };
  }

  private async parseFile(file: Express.Multer.File): Promise<RawRow[]> {
    const mimetype = file.mimetype;

    if (
      mimetype === 'text/csv' ||
      mimetype === 'application/csv' ||
      file.originalname.endsWith('.csv')
    ) {
      return this.parseCsv(file.buffer);
    }

    if (
      mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.xlsx')
    ) {
      return this.parseXlsx(file.buffer);
    }

    throw new BadRequestException(
      'Unsupported file format. Please upload a CSV or XLSX file.',
    );
  }

  private parseCsv(buffer: Buffer): RawRow[] {
    const content = buffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');

    if (lines.length < 2) {
      return [];
    }

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());

    const rows: RawRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter);
      const row: RawRow = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j]?.trim() ?? '';
      }
      rows.push(row);
    }

    return rows;
  }

  private async parseXlsx(buffer: Buffer): Promise<RawRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) {
      return [];
    }

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = String(cell.value ?? '').trim().toLowerCase();
    });

    const rows: RawRow[] = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
      const excelRow = sheet.getRow(i);
      if (excelRow.cellCount === 0) continue;

      const row: RawRow = {};
      let hasData = false;
      excelRow.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          row[header] = cell.value as string | number | boolean | null;
          if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
            hasData = true;
          }
        }
      });

      if (hasData) {
        rows.push(row);
      }
    }

    return rows;
  }

  private validateRow(
    raw: RawRow,
    rowNumber: number,
    existingCodigos: Set<string>,
    seenCodigos: Set<string>,
  ): ImportError[] {
    const errors: ImportError[] = [];

    const codigo = String(raw['codigo'] ?? '').trim();
    if (!codigo) {
      errors.push({ row: rowNumber, field: 'codigo', value: '', message: 'Required field' });
    } else if (codigo.length > 50) {
      errors.push({ row: rowNumber, field: 'codigo', value: codigo, message: 'Max length 50 characters' });
    } else if (existingCodigos.has(codigo)) {
      errors.push({ row: rowNumber, field: 'codigo', value: codigo, message: 'Duplicate codigo already exists in database' });
    } else if (seenCodigos.has(codigo)) {
      errors.push({ row: rowNumber, field: 'codigo', value: codigo, message: 'Duplicate codigo within file' });
    }

    const descricao = String(raw['descricao'] ?? '').trim();
    if (!descricao) {
      errors.push({ row: rowNumber, field: 'descricao', value: '', message: 'Required field' });
    } else if (descricao.length > 255) {
      errors.push({ row: rowNumber, field: 'descricao', value: descricao, message: 'Max length 255 characters' });
    }

    const tipoProduto = String(raw['tipo_produto'] ?? '').trim();
    if (!tipoProduto) {
      errors.push({ row: rowNumber, field: 'tipo_produto', value: '', message: 'Required field' });
    } else if (!TIPO_PRODUTO_VALUES.has(tipoProduto as TipoProduto)) {
      errors.push({
        row: rowNumber,
        field: 'tipo_produto',
        value: tipoProduto,
        message: `Invalid value. Must be one of: ${[...TIPO_PRODUTO_VALUES].join(', ')}`,
      });
    }

    const politica = String(raw['politica_ressuprimento'] ?? '').trim();
    if (politica && !POLITICA_VALUES.has(politica as PoliticaRessuprimento)) {
      errors.push({
        row: rowNumber,
        field: 'politica_ressuprimento',
        value: politica,
        message: `Invalid value. Must be one of: ${[...POLITICA_VALUES].join(', ')}`,
      });
    }

    return errors;
  }

  private mapRow(raw: RawRow): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};

    for (const [csvCol, dtoField] of Object.entries(COLUMN_MAP)) {
      const value = raw[csvCol];
      if (value === undefined || value === null || value === '') continue;

      switch (dtoField) {
        case 'ativo':
          mapped[dtoField] = String(value).toLowerCase() === 'true' || value === true;
          break;
        case 'pesoLiquidoKg':
        case 'volumeM3':
        case 'custoUnitario':
        case 'custoPedido':
        case 'custoManutencaoPctAno':
        case 'precoVenda':
        case 'loteMinimo':
        case 'multiploCompra':
        case 'estoqueSegurancaManual':
          mapped[dtoField] = Number(value);
          break;
        case 'intervaloRevisaoDias':
        case 'leadTimeProducaoDias':
          mapped[dtoField] = parseInt(String(value), 10);
          break;
        default:
          mapped[dtoField] = String(value).trim();
      }
    }

    return mapped;
  }
}
