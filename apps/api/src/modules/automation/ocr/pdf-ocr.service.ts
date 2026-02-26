import { Injectable, Logger } from '@nestjs/common';

export interface OcrRow {
  readonly [key: string]: string;
}

export interface OcrResult {
  readonly rows: readonly OcrRow[];
  readonly confidence: number;
  readonly lowConfidenceRows: readonly number[];
}

const CONFIDENCE_THRESHOLD = 0.7;

/**
 * PDF OCR Service
 *
 * Extracts tabular data from PDF attachments using pdf-parse.
 * Reports confidence score and flags low-confidence rows.
 *
 * @see Story 4.3 — AC-9, AC-10, AC-11
 */
@Injectable()
export class PdfOcrService {
  private readonly logger = new Logger(PdfOcrService.name);

  async extractFromPdf(buffer: Buffer): Promise<OcrResult> {
    const pdfParse = await this.loadPdfParse();
    const parsed = await pdfParse(buffer);
    const text = parsed.text;

    const lines = text
      .split(/\r?\n/)
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    if (lines.length < 2) {
      return { rows: [], confidence: 0, lowConfidenceRows: [] };
    }

    const delimiter = this.detectDelimiter(lines[0]);
    const headers = lines[0].split(delimiter).map((h: string) => h.trim().toLowerCase());

    const rows: OcrRow[] = [];
    const lowConfidenceRows: number[] = [];
    let totalConfidence = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter);
      if (values.length < headers.length * 0.5) continue;

      const row: Record<string, string> = {};
      let rowFilledFields = 0;

      for (let j = 0; j < headers.length; j++) {
        const val = values[j]?.trim() ?? '';
        row[headers[j]] = val;
        if (val.length > 0) rowFilledFields++;
      }

      const rowConfidence = headers.length > 0 ? rowFilledFields / headers.length : 0;
      totalConfidence += rowConfidence;

      if (rowConfidence < CONFIDENCE_THRESHOLD) {
        lowConfidenceRows.push(i + 1);
      }

      rows.push(row);
    }

    const avgConfidence = rows.length > 0 ? totalConfidence / rows.length : 0;

    this.logger.log(
      `PDF OCR: ${rows.length} rows extracted, confidence=${avgConfidence.toFixed(2)}, low-confidence=${lowConfidenceRows.length}`,
    );

    return {
      rows,
      confidence: Math.round(avgConfidence * 100) / 100,
      lowConfidenceRows,
    };
  }

  toCsv(result: OcrResult): string {
    if (result.rows.length === 0) return '';

    const headers = Object.keys(result.rows[0]);
    const lines = [headers.join(',')];

    for (const row of result.rows) {
      const values = headers.map((h) => {
        const val = row[h] ?? '';
        return val.includes(',') || val.includes('"')
          ? `"${val.replace(/"/g, '""')}"`
          : val;
      });
      lines.push(values.join(','));
    }

    return lines.join('\n');
  }

  private detectDelimiter(line: string): string | RegExp {
    if (line.includes('\t')) return '\t';
    if (line.includes(';')) return ';';
    if (line.includes(',')) return ',';
    return /\s{2,}/;
  }

  private async loadPdfParse(): Promise<any> {
    try {
      return (await import('pdf-parse')).default;
    } catch {
      throw new Error('pdf-parse is not installed. Run: npm install pdf-parse');
    }
  }
}
