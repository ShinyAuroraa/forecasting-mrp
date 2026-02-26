import { PdfOcrService } from './pdf-ocr.service';

jest.mock('pdf-parse', () => {
  return jest.fn().mockImplementation((buffer: Buffer) => {
    const text = buffer.toString('utf-8');
    return Promise.resolve({ text, numpages: 1 });
  });
});

describe('PdfOcrService', () => {
  let service: PdfOcrService;

  beforeEach(() => {
    service = new PdfOcrService();
  });

  describe('extractFromPdf', () => {
    it('should extract rows from CSV-like PDF text', async () => {
      const text = 'produto,quantidade,valor\nProduto A,100,50.00\nProduto B,200,75.50';
      const buffer = Buffer.from(text, 'utf-8');

      const result = await service.extractFromPdf(buffer);

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({
        produto: 'Produto A',
        quantidade: '100',
        valor: '50.00',
      });
      expect(result.rows[1]).toEqual({
        produto: 'Produto B',
        quantidade: '200',
        valor: '75.50',
      });
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should return empty result for single-line PDF', async () => {
      const buffer = Buffer.from('Just a title line', 'utf-8');

      const result = await service.extractFromPdf(buffer);

      expect(result.rows).toHaveLength(0);
      expect(result.confidence).toBe(0);
    });

    it('should flag low-confidence rows', async () => {
      const text = 'col1,col2,col3,col4\nA,,,\nB,C,D,E';
      const buffer = Buffer.from(text, 'utf-8');

      const result = await service.extractFromPdf(buffer);

      expect(result.rows).toHaveLength(2);
      expect(result.lowConfidenceRows.length).toBeGreaterThan(0);
    });

    it('should detect tab delimiter', async () => {
      const text = 'nome\tqtd\tvalor\nItem1\t10\t5.00';
      const buffer = Buffer.from(text, 'utf-8');

      const result = await service.extractFromPdf(buffer);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toHaveProperty('nome', 'Item1');
    });

    it('should detect semicolon delimiter', async () => {
      const text = 'nome;qtd;valor\nItem1;10;5.00';
      const buffer = Buffer.from(text, 'utf-8');

      const result = await service.extractFromPdf(buffer);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toHaveProperty('nome', 'Item1');
    });
  });

  describe('toCsv', () => {
    it('should convert OcrResult to CSV string', () => {
      const result = {
        rows: [
          { nome: 'A', valor: '10' },
          { nome: 'B', valor: '20' },
        ],
        confidence: 0.95,
        lowConfidenceRows: [],
      };

      const csv = service.toCsv(result);
      const lines = csv.split('\n');

      expect(lines[0]).toBe('nome,valor');
      expect(lines[1]).toBe('A,10');
      expect(lines[2]).toBe('B,20');
    });

    it('should handle values with commas by quoting', () => {
      const result = {
        rows: [{ nome: 'Item, especial', valor: '10' }],
        confidence: 0.9,
        lowConfidenceRows: [],
      };

      const csv = service.toCsv(result);
      expect(csv).toContain('"Item, especial"');
    });

    it('should return empty string for empty rows', () => {
      const result = { rows: [], confidence: 0, lowConfidenceRows: [] };
      expect(service.toCsv(result)).toBe('');
    });
  });
});
