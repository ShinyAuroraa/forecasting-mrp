import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ForecastOverrideService } from './forecast-override.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ForecastOverrideService', () => {
  let service: ForecastOverrideService;
  let mockPrisma: Record<string, unknown>;
  let mockForecastOverride: Record<string, jest.Mock>;
  let mockProduto: Record<string, jest.Mock>;

  const mockOverrideData = {
    id: 'override-1',
    forecastResultadoId: 'fr-1',
    produtoId: 'prod-1',
    periodo: new Date('2026-03-01'),
    originalP50: 100.0,
    overrideP50: 120.0,
    motivo: 'Promoção de verão',
    categoriaOverride: 'PROMOTION',
    revertedFromId: null,
    createdBy: 'user-1',
    createdAt: new Date('2026-02-28'),
    produto: { id: 'prod-1', codigo: 'SKU-001', descricao: 'Produto A' },
  };

  beforeEach(async () => {
    mockForecastOverride = {
      create: jest.fn().mockResolvedValue(mockOverrideData),
      findMany: jest.fn().mockResolvedValue([mockOverrideData]),
      findUnique: jest.fn().mockResolvedValue(mockOverrideData),
      count: jest.fn().mockResolvedValue(1),
    };

    mockProduto = {
      findUnique: jest.fn().mockResolvedValue({ id: 'prod-1' }),
    };

    mockPrisma = {
      forecastOverride: mockForecastOverride,
      produto: mockProduto,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForecastOverrideService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ForecastOverrideService>(ForecastOverrideService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create — AC-3, AC-7', () => {
    it('should create an override successfully', async () => {
      const result = await service.create({
        produtoId: 'prod-1',
        periodo: '2026-03-01',
        overrideP50: 120.0,
        motivo: 'Promoção de verão',
        categoriaOverride: 'PROMOTION' as any,
        originalP50: 100.0,
        forecastResultadoId: 'fr-1',
      }, 'user-1');

      expect(result).toEqual(mockOverrideData);
      expect(mockForecastOverride.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            produtoId: 'prod-1',
            overrideP50: 120.0,
            motivo: 'Promoção de verão',
            categoriaOverride: 'PROMOTION',
            createdBy: 'user-1',
          }),
        }),
      );
    });

    it('should throw NotFoundException if product does not exist', async () => {
      mockProduto.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          produtoId: 'nonexistent',
          periodo: '2026-03-01',
          overrideP50: 100.0,
          motivo: 'Test',
          categoriaOverride: 'OTHER' as any,
        }, undefined),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for negative override value', async () => {
      await expect(
        service.create({
          produtoId: 'prod-1',
          periodo: '2026-03-01',
          overrideP50: -5,
          motivo: 'Test',
          categoriaOverride: 'OTHER' as any,
        }, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for empty motivo', async () => {
      await expect(
        service.create({
          produtoId: 'prod-1',
          periodo: '2026-03-01',
          overrideP50: 100,
          motivo: '   ',
          categoriaOverride: 'OTHER' as any,
        }, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set forecastResultadoId to null when not provided', async () => {
      await service.create({
        produtoId: 'prod-1',
        periodo: '2026-03-01',
        overrideP50: 100,
        motivo: 'Manual entry',
        categoriaOverride: 'OTHER' as any,
      }, undefined);

      expect(mockForecastOverride.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            forecastResultadoId: null,
            createdBy: null,
          }),
        }),
      );
    });
  });

  describe('findByProduct — AC-4', () => {
    it('should return paginated overrides for a product', async () => {
      const result = await service.findByProduct('prod-1');

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockForecastOverride.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { produtoId: 'prod-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('findAll — AC-5', () => {
    it('should apply date range filters', async () => {
      await service.findAll({
        dateFrom: '2026-01-01',
        dateTo: '2026-03-31',
        page: 1,
        limit: 50,
      } as any);

      expect(mockForecastOverride.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            periodo: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-03-31'),
            },
          }),
        }),
      );
    });

    it('should apply categoria filter', async () => {
      await service.findAll({
        categoriaOverride: 'SEASONAL',
        page: 1,
        limit: 50,
      } as any);

      expect(mockForecastOverride.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoriaOverride: 'SEASONAL',
          }),
        }),
      );
    });

    it('should return empty results when no overrides', async () => {
      mockForecastOverride.findMany.mockResolvedValue([]);
      mockForecastOverride.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, limit: 50 } as any);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('findById — AC-10', () => {
    it('should return a single override', async () => {
      const result = await service.findById('override-1');

      expect(result.id).toBe('override-1');
    });

    it('should throw NotFoundException when not found', async () => {
      mockForecastOverride.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('revert — AC-6', () => {
    it('should create a revert override', async () => {
      const result = await service.revert('override-1', 'user-2');

      expect(mockForecastOverride.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            produtoId: 'prod-1',
            overrideP50: 100.0, // original value restored
            revertedFromId: 'override-1',
            createdBy: 'user-2',
          }),
        }),
      );
    });

    it('should throw NotFoundException when original override not found', async () => {
      mockForecastOverride.findUnique.mockResolvedValue(null);

      await expect(service.revert('nonexistent', undefined)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when originalP50 is null', async () => {
      mockForecastOverride.findUnique.mockResolvedValue({
        ...mockOverrideData,
        originalP50: null,
      });

      await expect(service.revert('override-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when reverting a revert entry', async () => {
      mockForecastOverride.findUnique.mockResolvedValue({
        ...mockOverrideData,
        revertedFromId: 'some-original-id',
      });

      await expect(service.revert('override-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should include REVERT prefix in motivo', async () => {
      await service.revert('override-1');

      expect(mockForecastOverride.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            motivo: expect.stringContaining('REVERT'),
          }),
        }),
      );
    });
  });
});
