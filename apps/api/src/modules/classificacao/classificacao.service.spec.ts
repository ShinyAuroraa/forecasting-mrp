import { NotFoundException } from '@nestjs/common';
import { ClassificacaoService } from './classificacao.service';

const mockRepository = {
  findAll: jest.fn(),
  findByProdutoId: jest.fn(),
  update: jest.fn(),
  upsert: jest.fn(),
  getTimeSeriesData: jest.fn(),
  getActiveProductIds: jest.fn(),
};

describe('ClassificacaoService', () => {
  let service: ClassificacaoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClassificacaoService(mockRepository as any);
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const paginated = {
        data: [{ id: '1' }],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockRepository.findAll.mockResolvedValue(paginated);
      const result = await service.findAll({} as any);
      expect(result).toEqual(paginated);
    });
  });

  describe('findByProdutoId', () => {
    it('should return when found', async () => {
      mockRepository.findByProdutoId.mockResolvedValue({ produtoId: 'p1', classeAbc: 'A' });
      const result = await service.findByProdutoId('p1');
      expect(result.classeAbc).toBe('A');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findByProdutoId.mockResolvedValue(null);
      await expect(service.findByProdutoId('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update when found', async () => {
      mockRepository.findByProdutoId.mockResolvedValue({ produtoId: 'p1' });
      mockRepository.update.mockResolvedValue({ produtoId: 'p1', classeAbc: 'B' });
      const result = await service.update('p1', { classeAbc: 'B' as any });
      expect(result.classeAbc).toBe('B');
    });
  });

  describe('calculateAbc', () => {
    it('should classify by Pareto thresholds', () => {
      const aggregations = [
        { produtoId: 'p1', totalReceita: 8000, weeklyVolumes: [] },
        { produtoId: 'p2', totalReceita: 1200, weeklyVolumes: [] },
        { produtoId: 'p3', totalReceita: 500, weeklyVolumes: [] },
        { produtoId: 'p4', totalReceita: 300, weeklyVolumes: [] },
      ];
      const result = service.calculateAbc(aggregations);
      expect(result.get('p1')).toBe('A');
      expect(result.get('p2')).toBe('B');
      expect(result.get('p3')).toBe('C');
      expect(result.get('p4')).toBe('C');
    });

    it('should assign C to all when total revenue is zero', () => {
      const aggregations = [
        { produtoId: 'p1', totalReceita: 0, weeklyVolumes: [] },
        { produtoId: 'p2', totalReceita: 0, weeklyVolumes: [] },
      ];
      const result = service.calculateAbc(aggregations);
      expect(result.get('p1')).toBe('C');
      expect(result.get('p2')).toBe('C');
    });
  });

  describe('calculateXyz', () => {
    it('should return X for low variability (CV <= 0.5)', () => {
      const volumes = [100, 105, 98, 102, 100, 103, 99, 101];
      expect(service.calculateXyz(volumes)).toBe('X');
    });

    it('should return Y for medium variability (0.5 < CV <= 1.0)', () => {
      const volumes = [100, 50, 150, 20, 200, 80, 120, 40];
      expect(service.calculateXyz(volumes)).toBe('Y');
    });

    it('should return Z for high variability (CV > 1.0)', () => {
      const volumes = [0, 0, 500, 0, 0, 0, 1000, 0];
      expect(service.calculateXyz(volumes)).toBe('Z');
    });

    it('should return Z for empty volumes', () => {
      expect(service.calculateXyz([])).toBe('Z');
    });
  });

  describe('calculateDemandPattern', () => {
    it('should return REGULAR for <= 5% zeros', () => {
      const volumes = Array(20).fill(100);
      expect(service.calculateDemandPattern(volumes)).toBe('REGULAR');
    });

    it('should return INTERMITENTE for 5-25% zeros', () => {
      const volumes = [...Array(16).fill(100), ...Array(4).fill(0)];
      expect(service.calculateDemandPattern(volumes)).toBe('INTERMITENTE');
    });

    it('should return ERRATICO for 25-50% zeros', () => {
      const volumes = [...Array(12).fill(100), ...Array(8).fill(0)];
      expect(service.calculateDemandPattern(volumes)).toBe('ERRATICO');
    });

    it('should return LUMPY for > 50% zeros', () => {
      const volumes = [...Array(4).fill(100), ...Array(16).fill(0)];
      expect(service.calculateDemandPattern(volumes)).toBe('LUMPY');
    });

    it('should return LUMPY for empty volumes', () => {
      expect(service.calculateDemandPattern([])).toBe('LUMPY');
    });
  });

  describe('calculateCv', () => {
    it('should return 0 for empty array', () => {
      expect(service.calculateCv([])).toBe(0);
    });

    it('should return 0 for all zeros', () => {
      expect(service.calculateCv([0, 0, 0])).toBe(0);
    });

    it('should return 0 for constant values', () => {
      expect(service.calculateCv([100, 100, 100])).toBe(0);
    });

    it('should calculate correct CV for varying values', () => {
      const cv = service.calculateCv([100, 200, 300]);
      expect(cv).toBeGreaterThan(0);
      expect(cv).toBeLessThan(1);
    });
  });

  describe('aggregateByProduct', () => {
    it('should aggregate time series by product and week', () => {
      const data = [
        { produtoId: 'p1', dataReferencia: new Date('2026-01-06'), volume: 100, receita: 500 },
        { produtoId: 'p1', dataReferencia: new Date('2026-01-07'), volume: 50, receita: 250 },
        { produtoId: 'p2', dataReferencia: new Date('2026-01-06'), volume: 200, receita: 1000 },
      ];
      const result = service.aggregateByProduct(data, ['p1', 'p2']);
      expect(result).toHaveLength(2);
      const p1 = result.find((r) => r.produtoId === 'p1')!;
      expect(p1.totalReceita).toBe(750);
    });

    it('should filter out inactive products', () => {
      const data = [
        { produtoId: 'p1', dataReferencia: new Date('2026-01-06'), volume: 100, receita: 500 },
        { produtoId: 'p3', dataReferencia: new Date('2026-01-06'), volume: 200, receita: 1000 },
      ];
      const result = service.aggregateByProduct(data, ['p1']);
      expect(result).toHaveLength(1);
      expect(result[0].produtoId).toBe('p1');
    });
  });

  describe('recalculate', () => {
    it('should recalculate and return distribution', async () => {
      mockRepository.getTimeSeriesData.mockResolvedValue([
        { produtoId: 'p1', dataReferencia: new Date('2026-01-06'), volume: 100, receita: 8000 },
        { produtoId: 'p2', dataReferencia: new Date('2026-01-06'), volume: 50, receita: 2000 },
      ]);
      mockRepository.getActiveProductIds.mockResolvedValue(['p1', 'p2']);
      mockRepository.upsert.mockResolvedValue({});

      const result = await service.recalculate();

      expect(result.totalClassified).toBe(2);
      expect(result.distribution.abc).toBeDefined();
      expect(result.distribution.xyz).toBeDefined();
      expect(result.distribution.demanda).toBeDefined();
      expect(result.calculadoEm).toBeDefined();
      expect(mockRepository.upsert).toHaveBeenCalledTimes(2);
    });
  });
});
