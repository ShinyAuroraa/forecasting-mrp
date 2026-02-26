import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { MappingTemplateRepository } from './mapping-template.repository';

export interface ImportError {
  row: number;
  field: string;
  value: string;
  message: string;
}

export interface ImportResult {
  imported: number;
  updated: number;
  rejected: number;
  errors: ImportError[];
  templateUsed?: string;
}

interface RawRow {
  [key: string]: string | number | boolean | null | undefined;
}

interface ColumnMapping {
  readonly sourceColumn: string;
  readonly targetField: string;
  readonly dataType: 'string' | 'number' | 'date' | 'boolean';
  readonly transformation?: string;
  readonly required: boolean;
}

const DEFAULT_COLUMN_MAP: Record<string, string> = {
  codigo: 'codigo',
  sku: 'codigo',
  produto: 'codigo',
  data: 'dataReferencia',
  data_referencia: 'dataReferencia',
  date: 'dataReferencia',
  volume: 'volume',
  quantidade: 'volume',
  qty: 'volume',
  receita: 'receita',
  faturamento: 'receita',
  revenue: 'receita',
  granularidade: 'granularidade',
  fonte: 'fonte',
  qualidade: 'qualidade',
};

const VALID_GRANULARIDADES = new Set(['diario', 'semanal', 'mensal']);

@Injectable()
export class IngestaoUploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateRepository: MappingTemplateRepository,
  ) {}

  async processUpload(
    file: Express.Multer.File,
    defaultGranularidade: string = 'semanal',
    templateId?: string,
  ): Promise<ImportResult> {
    const rows = await this.parseFile(file);

    if (rows.length === 0) {
      throw new BadRequestException('File contains no data rows');
    }

    const columnMap = templateId
      ? await this.buildColumnMapFromTemplate(templateId)
      : DEFAULT_COLUMN_MAP;

    const produtoMap = new Map(
      (
        await this.prisma.produto.findMany({
          select: { id: true, codigo: true },
        })
      ).map((p) => [p.codigo.toLowerCase(), p.id]),
    );

    const errors: ImportError[] = [];
    let imported = 0;
    let updated = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const raw = rows[i];
      const mapped = this.mapRow(raw, columnMap);

      const rowErrors = this.validateRow(mapped, rowNumber, produtoMap);
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }

      const codigo = String(mapped.codigo).toLowerCase();
      const produtoId = produtoMap.get(codigo)!;
      const dataReferencia = this.parseDate(mapped.dataReferencia as string);
      const granularidade =
        mapped.granularidade && VALID_GRANULARIDADES.has(String(mapped.granularidade))
          ? String(mapped.granularidade)
          : defaultGranularidade;

      try {
        const existing = await this.prisma.serieTemporal.findFirst({
          where: {
            produtoId,
            dataReferencia,
            granularidade: granularidade as any,
          },
        });

        if (existing) {
          await this.prisma.serieTemporal.update({
            where: { id: existing.id },
            data: {
              volume: mapped.volume !== undefined ? Number(mapped.volume) : undefined,
              receita: mapped.receita !== undefined ? Number(mapped.receita) : undefined,
              fonte: mapped.fonte ? String(mapped.fonte) : 'UPLOAD',
              qualidade: mapped.qualidade !== undefined ? Number(mapped.qualidade) : undefined,
            },
          });
          updated++;
        } else {
          await this.prisma.serieTemporal.create({
            data: {
              produtoId,
              dataReferencia,
              granularidade: granularidade as any,
              volume: mapped.volume !== undefined ? Number(mapped.volume) : 0,
              receita: mapped.receita !== undefined ? Number(mapped.receita) : 0,
              fonte: mapped.fonte ? String(mapped.fonte) : 'UPLOAD',
              qualidade: mapped.qualidade !== undefined ? Number(mapped.qualidade) : undefined,
            },
          });
          imported++;
        }
      } catch {
        errors.push({
          row: rowNumber,
          field: 'database',
          value: String(mapped.codigo),
          message: 'Failed to upsert row into database',
        });
      }
    }

    if (templateId) {
      await this.templateRepository.incrementUsage(templateId).catch(() => {});
    }

    return {
      imported,
      updated,
      rejected: errors.length,
      errors,
      ...(templateId && { templateUsed: templateId }),
    };
  }

  private async buildColumnMapFromTemplate(
    templateId: string,
  ): Promise<Record<string, string>> {
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new BadRequestException(`Template ${templateId} not found`);
    }

    const colunas = template.colunas as unknown as ColumnMapping[];
    const columnMap: Record<string, string> = {};

    for (const col of colunas) {
      columnMap[col.sourceColumn.toLowerCase()] = col.targetField;
    }

    return columnMap;
  }

  async parseFile(file: Express.Multer.File): Promise<RawRow[]> {
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

  async extractHeaders(file: Express.Multer.File): Promise<string[]> {
    const rows = await this.parseFile(file);
    if (rows.length === 0) return [];
    return Object.keys(rows[0]);
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

  private mapRow(
    raw: RawRow,
    columnMap: Record<string, string>,
  ): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};

    for (const [csvCol, dtoField] of Object.entries(columnMap)) {
      const value = raw[csvCol];
      if (value === undefined || value === null || value === '') continue;

      if (mapped[dtoField] !== undefined) continue;

      switch (dtoField) {
        case 'volume':
        case 'receita':
        case 'qualidade':
          mapped[dtoField] = Number(value);
          break;
        default:
          mapped[dtoField] = String(value).trim();
      }
    }

    return mapped;
  }

  private validateRow(
    mapped: Record<string, unknown>,
    rowNumber: number,
    produtoMap: Map<string, string>,
  ): ImportError[] {
    const errors: ImportError[] = [];

    const codigo = mapped.codigo ? String(mapped.codigo).trim() : '';
    if (!codigo) {
      errors.push({
        row: rowNumber,
        field: 'codigo',
        value: '',
        message: 'Required field: SKU code',
      });
    } else if (!produtoMap.has(codigo.toLowerCase())) {
      errors.push({
        row: rowNumber,
        field: 'codigo',
        value: codigo,
        message: 'SKU not found in product database',
      });
    }

    const dataRef = mapped.dataReferencia
      ? String(mapped.dataReferencia).trim()
      : '';
    if (!dataRef) {
      errors.push({
        row: rowNumber,
        field: 'dataReferencia',
        value: '',
        message: 'Required field: date',
      });
    } else {
      const parsed = this.parseDate(dataRef);
      if (isNaN(parsed.getTime())) {
        errors.push({
          row: rowNumber,
          field: 'dataReferencia',
          value: dataRef,
          message: 'Invalid date format',
        });
      }
    }

    if (mapped.volume === undefined && mapped.receita === undefined) {
      errors.push({
        row: rowNumber,
        field: 'volume/receita',
        value: '',
        message: 'At least one of volume or receita is required',
      });
    }

    if (mapped.volume !== undefined && isNaN(Number(mapped.volume))) {
      errors.push({
        row: rowNumber,
        field: 'volume',
        value: String(mapped.volume),
        message: 'Must be a valid number',
      });
    }

    if (mapped.receita !== undefined && isNaN(Number(mapped.receita))) {
      errors.push({
        row: rowNumber,
        field: 'receita',
        value: String(mapped.receita),
        message: 'Must be a valid number',
      });
    }

    return errors;
  }

  private parseDate(value: string): Date {
    // Try DD/MM/YYYY format
    const brMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) {
      return new Date(`${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`);
    }

    // Try ISO or other standard formats
    return new Date(value);
  }
}
