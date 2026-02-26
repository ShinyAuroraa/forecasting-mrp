import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LeadTimeTrackingService } from './lead-time-tracking.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('LeadTimeTrackingService', () => {
  let service: LeadTimeTrackingService;
  let mockHistoricoLeadTime: Record<string, jest.Mock>;
  let mockProdutoFornecedor: Record<string, jest.Mock>;
  let mockPrisma: Record<string, unknown>;

  const mockRecord = {
    id: 'lt-1',
    produtoFornecedorId: 'pf-1',
    leadTimeRealDias: 12,
    leadTimePlanejadoDias: 10,
    dataEntrega: new Date('2026-02-15'),
    pedidoRef: 'PO-001',
    observacao: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    mockHistoricoLeadTime = {
      create: jest.fn().mockResolvedValue(mockRecord),
      findMany: jest.fn().mockResolvedValue([mockRecord]),
      count: jest.fn().mockResolvedValue(1),
    };

    mockProdutoFornecedor = {
      findUnique: jest.fn().mockResolvedValue({ id: 'pf-1' }),
      findFirst: jest.fn().mockResolvedValue({ id: 'pf-1' }),
    };

    mockPrisma = {
      historicoLeadTime: mockHistoricoLeadTime,
      produtoFornecedor: mockProdutoFornecedor,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadTimeTrackingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LeadTimeTrackingService>(LeadTimeTrackingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- AC-4: record ---

  describe('record — AC-4', () => {
    it('should record a new lead time observation', async () => {
      const result = await service.record({
        produtoFornecedorId: 'pf-1',
        leadTimeRealDias: 12,
        leadTimePlanejadoDias: 10,
        dataEntrega: '2026-02-15',
        pedidoRef: 'PO-001',
      });

      expect(result).toEqual(mockRecord);
      expect(mockHistoricoLeadTime.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            produtoFornecedorId: 'pf-1',
            leadTimeRealDias: 12,
            leadTimePlanejadoDias: 10,
          }),
        }),
      );
    });

    it('should throw NotFoundException if ProdutoFornecedor does not exist', async () => {
      mockProdutoFornecedor.findUnique.mockResolvedValue(null);

      await expect(
        service.record({
          produtoFornecedorId: 'nonexistent',
          leadTimeRealDias: 10,
          dataEntrega: '2026-02-15',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle optional fields as null', async () => {
      await service.record({
        produtoFornecedorId: 'pf-1',
        leadTimeRealDias: 10,
        dataEntrega: '2026-02-15',
      });

      expect(mockHistoricoLeadTime.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            leadTimePlanejadoDias: null,
            pedidoRef: null,
            observacao: null,
          }),
        }),
      );
    });
  });

  // --- AC-5: getHistory ---

  describe('getHistory — AC-5', () => {
    it('should return paginated history', async () => {
      const result = await service.getHistory('pf-1');

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockHistoricoLeadTime.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { produtoFornecedorId: 'pf-1' },
          orderBy: { dataEntrega: 'desc' },
        }),
      );
    });

    it('should apply pagination parameters', async () => {
      await service.getHistory('pf-1', 2, 25);

      expect(mockHistoricoLeadTime.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 25,
          take: 25,
        }),
      );
    });
  });

  // --- AC-6: calculateStats ---

  describe('calculateStats — AC-6', () => {
    it('should compute correct statistics from known dataset (AC-13)', async () => {
      // Sample stddev of [10,12,14,8,16]: sqrt(sum(v-mean)^2 / (n-1)) = sqrt(40/4) = sqrt(10) ≈ 3.162
      mockHistoricoLeadTime.findMany.mockResolvedValue([
        { leadTimeRealDias: 10 },
        { leadTimeRealDias: 12 },
        { leadTimeRealDias: 14 },
        { leadTimeRealDias: 8 },
        { leadTimeRealDias: 16 },
      ]);

      const stats = await service.calculateStats('pf-1');

      expect(stats.count).toBe(5);
      expect(stats.mean).toBe(12);
      expect(stats.min).toBe(8);
      expect(stats.max).toBe(16);
      // Sample stddev of [10,12,14,8,16] = sqrt(40/4) = sqrt(10) ≈ 3.16
      expect(stats.stddev).toBeCloseTo(3.16, 1);
      expect(stats.sigmaLtDias).toBeCloseTo(3.16, 1);
    });

    it('should return zeros when no records exist', async () => {
      mockHistoricoLeadTime.findMany.mockResolvedValue([]);

      const stats = await service.calculateStats('pf-1');

      expect(stats.count).toBe(0);
      expect(stats.mean).toBe(0);
      expect(stats.stddev).toBe(0);
    });

    it('should handle single record (stddev = 0)', async () => {
      mockHistoricoLeadTime.findMany.mockResolvedValue([
        { leadTimeRealDias: 10 },
      ]);

      const stats = await service.calculateStats('pf-1');

      expect(stats.count).toBe(1);
      expect(stats.mean).toBe(10);
      expect(stats.stddev).toBe(0);
    });
  });

  // --- AC-7: getSigmaLt ---

  describe('getSigmaLt — AC-7', () => {
    it('should return HISTORICAL sigma when >= 5 observations', async () => {
      mockHistoricoLeadTime.findMany.mockResolvedValue([
        { leadTimeRealDias: 10 },
        { leadTimeRealDias: 12 },
        { leadTimeRealDias: 14 },
        { leadTimeRealDias: 8 },
        { leadTimeRealDias: 16 },
      ]);

      const result = await service.getSigmaLt('prod-1');

      expect(result).not.toBeNull();
      expect(result!.source).toBe('HISTORICAL');
      expect(result!.sigmaLtDias).toBeCloseTo(3.16, 1);
    });

    it('should return null when < 5 observations (AC-14 fallback)', async () => {
      mockHistoricoLeadTime.findMany.mockResolvedValue([
        { leadTimeRealDias: 10 },
        { leadTimeRealDias: 12 },
      ]);

      const result = await service.getSigmaLt('prod-1');
      expect(result).toBeNull();
    });

    it('should return null when no supplier found for product', async () => {
      mockProdutoFornecedor.findFirst.mockResolvedValue(null);

      const result = await service.getSigmaLt('nonexistent');
      expect(result).toBeNull();
    });

    it('should prefer principal supplier via orderBy', async () => {
      mockHistoricoLeadTime.findMany.mockResolvedValue([
        { leadTimeRealDias: 10 },
        { leadTimeRealDias: 12 },
        { leadTimeRealDias: 14 },
        { leadTimeRealDias: 8 },
        { leadTimeRealDias: 16 },
      ]);

      await service.getSigmaLt('prod-1');

      expect(mockProdutoFornecedor.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ isPrincipal: 'desc' }, { createdAt: 'asc' }],
        }),
      );
    });
  });
});
