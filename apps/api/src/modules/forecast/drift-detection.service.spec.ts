import { Test, TestingModule } from '@nestjs/testing';
import { DriftDetectionService } from './drift-detection.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DriftStatus } from './drift-detection.interfaces';

describe('DriftDetectionService', () => {
  let service: DriftDetectionService;
  let mockPrisma: Record<string, unknown>;
  let mockForecastMetrica: Record<string, jest.Mock>;
  let mockForecastModelo: Record<string, jest.Mock>;
  let mockExecucaoPlanejamento: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockForecastMetrica = {
      findMany: jest.fn().mockResolvedValue([]),
    };
    mockForecastModelo = {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    };
    mockExecucaoPlanejamento = {
      create: jest.fn().mockResolvedValue({ id: 'exec-1' }),
    };

    mockPrisma = {
      forecastMetrica: mockForecastMetrica,
      forecastModelo: mockForecastModelo,
      execucaoPlanejamento: mockExecucaoPlanejamento,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriftDetectionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DriftDetectionService>(DriftDetectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('computeDriftStatus — AC-13: drift calculation', () => {
    it('should return STABLE when no data', () => {
      const result = service.computeDriftStatus([]);
      expect(result.status).toBe(DriftStatus.STABLE);
      expect(result.currentMape).toBe(0);
    });

    it('should return STABLE with single data point', () => {
      const result = service.computeDriftStatus([5.0]);
      expect(result.status).toBe(DriftStatus.STABLE);
      expect(result.currentMape).toBe(5.0);
      expect(result.mapeIncreasePct).toBe(0);
    });

    it('should return STABLE when MAPE decreases', () => {
      const result = service.computeDriftStatus([4.0, 5.0, 6.0, 7.0, 8.0]);
      expect(result.status).toBe(DriftStatus.STABLE);
      expect(result.mapeIncreasePct).toBeLessThan(0);
    });

    it('should return STABLE when MAPE increase < 10%', () => {
      // Current: 5.4, rolling avg of [5.0, 5.1, 5.0, 5.0] = 5.025
      // Increase = (5.4 - 5.025) / 5.025 = 7.5% < 10%
      const result = service.computeDriftStatus([5.4, 5.0, 5.1, 5.0, 5.0]);
      expect(result.status).toBe(DriftStatus.STABLE);
    });

    it('should return WARNING when MAPE increase 10-15%', () => {
      // Current: 11.0, older: [10.0, 10.0, 10.0, 10.0] avg = 10.0
      // Increase = 10% = WARNING threshold
      const result = service.computeDriftStatus([11.0, 10.0, 10.0, 10.0, 10.0]);
      expect(result.status).toBe(DriftStatus.WARNING);
      expect(result.mapeIncreasePct).toBeCloseTo(0.10, 2);
    });

    it('should return DRIFTING when MAPE increase > 15%', () => {
      // Current: 12.0, older: [10.0, 10.0, 10.0, 10.0] avg = 10.0
      // Increase = 20% > 15%
      const result = service.computeDriftStatus([12.0, 10.0, 10.0, 10.0, 10.0]);
      expect(result.status).toBe(DriftStatus.DRIFTING);
      expect(result.mapeIncreasePct).toBeCloseTo(0.20, 2);
    });

    it('should use only last 4 values for rolling average', () => {
      // Current: 15.0, last 4: [10.0, 10.0, 10.0, 10.0], older values ignored
      const result = service.computeDriftStatus([15.0, 10.0, 10.0, 10.0, 10.0, 5.0, 5.0]);
      expect(result.rollingAvgMape).toBe(10.0);
      expect(result.mapeIncreasePct).toBeCloseTo(0.50, 2);
    });

    it('should handle custom thresholds', () => {
      // Current: 10.5, older avg: 10.0 → 5% increase
      // With custom thresholds: warning=0.04, drift=0.06
      const result = service.computeDriftStatus(
        [10.5, 10.0, 10.0, 10.0, 10.0],
        0.04, // warning at 4%
        0.06, // drift at 6%
      );
      expect(result.status).toBe(DriftStatus.WARNING);
    });
  });

  describe('computeDriftStatus — AC-14: status transitions', () => {
    it('STABLE → WARNING transition', () => {
      const stable = service.computeDriftStatus([10.0, 10.0, 10.0, 10.0]);
      expect(stable.status).toBe(DriftStatus.STABLE);

      // Now current MAPE jumps 12%
      const warning = service.computeDriftStatus([11.2, 10.0, 10.0, 10.0, 10.0]);
      expect(warning.status).toBe(DriftStatus.WARNING);
    });

    it('WARNING → DRIFTING transition', () => {
      // 11% increase → WARNING
      const warning = service.computeDriftStatus([11.1, 10.0, 10.0, 10.0, 10.0]);
      expect(warning.status).toBe(DriftStatus.WARNING);

      // 20% increase → DRIFTING
      const drifting = service.computeDriftStatus([12.0, 10.0, 10.0, 10.0, 10.0]);
      expect(drifting.status).toBe(DriftStatus.DRIFTING);
    });

    it('DRIFTING → STABLE recovery', () => {
      // Current: 12.0, avg: 10.0 → DRIFTING
      const drifting = service.computeDriftStatus([12.0, 10.0, 10.0, 10.0, 10.0]);
      expect(drifting.status).toBe(DriftStatus.DRIFTING);

      // After retraining: current 9.5, avg still high but current recovered
      const stable = service.computeDriftStatus([9.5, 12.0, 10.0, 10.0, 10.0]);
      expect(stable.status).toBe(DriftStatus.STABLE);
    });
  });

  describe('checkDrift — AC-15: endpoint integration', () => {
    it('should return drift check result', async () => {
      mockForecastMetrica.findMany.mockResolvedValue([
        { execucaoId: 'e1', mape: 5.0, createdAt: new Date() },
        { execucaoId: 'e2', mape: 4.8, createdAt: new Date() },
      ]);

      const result = await service.checkDrift('TFT');

      expect(result.tipoModelo).toBe('TFT');
      expect(result.status).toBeDefined();
      expect(result.checkedAt).toBeDefined();
      expect(result.recentMapes).toBeDefined();
    });

    it('should trigger retraining when drifting', async () => {
      // Mock metrics that show 50% MAPE increase
      mockForecastMetrica.findMany.mockResolvedValue([
        { execucaoId: 'e1', mape: 15.0, createdAt: new Date('2026-02-28') },
        { execucaoId: 'e2', mape: 10.0, createdAt: new Date('2026-02-21') },
        { execucaoId: 'e3', mape: 10.0, createdAt: new Date('2026-02-14') },
        { execucaoId: 'e4', mape: 10.0, createdAt: new Date('2026-02-07') },
        { execucaoId: 'e5', mape: 10.0, createdAt: new Date('2026-01-31') },
      ]);

      await service.checkDrift('TFT');

      expect(mockExecucaoPlanejamento.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'FORECAST',
            status: 'PENDENTE',
            gatilho: 'AUTO_INGESTAO',
            parametros: expect.objectContaining({
              source: 'drift_detection',
              tipoModelo: 'TFT',
            }),
          }),
        }),
      );
    });

    it('should NOT trigger retraining when stable', async () => {
      mockForecastMetrica.findMany.mockResolvedValue([
        { execucaoId: 'e1', mape: 5.0, createdAt: new Date() },
        { execucaoId: 'e2', mape: 5.1, createdAt: new Date() },
      ]);

      await service.checkDrift('TFT');

      expect(mockExecucaoPlanejamento.create).not.toHaveBeenCalled();
    });

    it('should store drift log in champion model', async () => {
      mockForecastMetrica.findMany.mockResolvedValue([
        { execucaoId: 'e1', mape: 5.0, createdAt: new Date() },
      ]);
      mockForecastModelo.findFirst.mockResolvedValue({
        id: 'model-1',
        metricasTreino: { avg_mape: 5.0 },
      });

      await service.checkDrift('TFT');

      expect(mockForecastModelo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'model-1' },
          data: expect.objectContaining({
            metricasTreino: expect.objectContaining({
              drift_log: expect.objectContaining({
                status: expect.any(String),
                checkedAt: expect.any(String),
              }),
            }),
          }),
        }),
      );
    });
  });

  describe('checkAllModels', () => {
    it('should check all distinct model types', async () => {
      mockForecastModelo.findMany.mockResolvedValue([
        { tipoModelo: 'TFT' },
        { tipoModelo: 'ETS' },
      ]);
      mockForecastMetrica.findMany.mockResolvedValue([]);

      const results = await service.checkAllModels();

      expect(results).toHaveLength(2);
      expect(results[0].tipoModelo).toBe('TFT');
      expect(results[1].tipoModelo).toBe('ETS');
    });
  });
});
