import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ForecastController } from './forecast.controller';
import { ForecastService } from './forecast.service';
import { DriftDetectionService } from './drift-detection.service';
import { ForecastOverrideService } from './forecast-override.service';
import { ExecuteForecastDto } from './dto/execute-forecast.dto';
import { FilterExecutionDto } from './dto/filter-execution.dto';
import { FilterMetricsDto } from './dto/filter-metrics.dto';
import { FilterModelsDto } from './dto/filter-models.dto';
import {
  ExecutionStatus,
  ForecastExecution,
  ExecutionWithSteps,
  ForecastJobType,
  ForecastMetric,
  ForecastModelMeta,
} from './forecast.interfaces';

describe('ForecastController', () => {
  let controller: ForecastController;
  let service: jest.Mocked<ForecastService>;

  const mockExecution: ForecastExecution = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    jobType: ForecastJobType.RUN_FORECAST,
    status: ExecutionStatus.QUEUED,
    produtoIds: null,
    modelo: null,
    horizonteSemanas: 13,
    holdoutWeeks: 13,
    forceRetrain: false,
    progress: 0,
    currentStep: null,
    errorMessage: null,
    durationSeconds: null,
    createdAt: new Date('2026-02-26'),
    updatedAt: new Date('2026-02-26'),
    completedAt: null,
  };

  const mockPaginatedExecutions = {
    data: [mockExecution],
    meta: {
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };

  const mockExecutionWithSteps: ExecutionWithSteps = {
    ...mockExecution,
    steps: [
      {
        id: 'step-1',
        executionId: mockExecution.id,
        step: 1,
        stepName: 'load_data',
        status: 'completed',
        productsProcessed: 10,
        productsTotal: 10,
        startedAt: new Date('2026-02-26'),
        completedAt: new Date('2026-02-26'),
      },
    ],
  };

  const mockMetric: ForecastMetric = {
    id: 'metric-1',
    executionId: mockExecution.id,
    produtoId: 'p1',
    modelName: 'NAIVE',
    classeAbc: 'A',
    mape: 5.2,
    mae: 10.0,
    rmse: 12.5,
    bias: -1.2,
    isBaseline: false,
    createdAt: new Date('2026-02-26'),
  };

  const mockPaginatedMetrics = {
    data: [mockMetric],
    meta: {
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };

  const mockModel: ForecastModelMeta = {
    id: 'model-1',
    modelName: 'NAIVE',
    version: 1,
    parameters: null,
    trainingMetrics: { mape: 5.0 },
    isChampion: true,
    trainedAt: new Date('2026-02-26'),
    createdAt: new Date('2026-02-26'),
  };

  const mockPaginatedModels = {
    data: [mockModel],
    meta: {
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ForecastController],
      providers: [
        {
          provide: ForecastService,
          useValue: {
            triggerExecution: jest.fn(),
            findAllExecutions: jest.fn(),
            findExecutionById: jest.fn(),
            findMetrics: jest.fn(),
            findModels: jest.fn(),
            findCurrentChampion: jest.fn(),
            findChampionHistory: jest.fn(),
          },
        },
        {
          provide: DriftDetectionService,
          useValue: {
            checkAllModels: jest.fn().mockResolvedValue([]),
            checkDrift: jest.fn().mockResolvedValue({
              tipoModelo: 'TFT',
              status: 'STABLE',
              currentMape: 5.0,
              rollingAvgMape: 5.0,
              mapeIncreasePct: 0,
              recentMapes: [5.0],
              checkedAt: new Date().toISOString(),
            }),
          },
        },
        {
          provide: ForecastOverrideService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'override-1' }),
            findAll: jest.fn().mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 0, hasNext: false, hasPrev: false } }),
            findById: jest.fn().mockResolvedValue({ id: 'override-1' }),
            revert: jest.fn().mockResolvedValue({ id: 'override-2' }),
          },
        },
      ],
    }).compile();

    controller = module.get<ForecastController>(ForecastController);
    service = module.get(ForecastService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('execute', () => {
    it('should trigger a forecast execution', async () => {
      const dto: ExecuteForecastDto = {
        jobType: 'run_forecast',
      } as ExecuteForecastDto;
      service.triggerExecution.mockResolvedValue(mockExecution as never);

      const result = await controller.execute(dto);

      expect(result).toEqual(mockExecution);
      expect(service.triggerExecution).toHaveBeenCalledWith(dto);
    });

    it('should trigger a train job with specific model', async () => {
      const dto: ExecuteForecastDto = {
        jobType: 'train_model',
        modelo: 'ETS',
        forceRetrain: true,
      } as ExecuteForecastDto;
      const trainExecution: ForecastExecution = {
        ...mockExecution,
        jobType: ForecastJobType.TRAIN_MODEL,
        modelo: 'ETS',
        forceRetrain: true,
      };
      service.triggerExecution.mockResolvedValue(trainExecution as never);

      const result = await controller.execute(dto);

      expect(result.jobType).toBe(ForecastJobType.TRAIN_MODEL);
      expect(result.modelo).toBe('ETS');
    });

    it('should trigger a backtest job with holdout weeks', async () => {
      const dto: ExecuteForecastDto = {
        jobType: 'run_backtest',
        holdoutWeeks: 26,
      } as ExecuteForecastDto;
      const backtestExecution: ForecastExecution = {
        ...mockExecution,
        jobType: ForecastJobType.RUN_BACKTEST,
        holdoutWeeks: 26,
      };
      service.triggerExecution.mockResolvedValue(backtestExecution as never);

      const result = await controller.execute(dto);

      expect(result.jobType).toBe(ForecastJobType.RUN_BACKTEST);
      expect(result.holdoutWeeks).toBe(26);
    });
  });

  describe('findAllExecutions', () => {
    it('should return paginated executions', async () => {
      const filters = new FilterExecutionDto();
      service.findAllExecutions.mockResolvedValue(
        mockPaginatedExecutions as never,
      );

      const result = await controller.findAllExecutions(filters);

      expect(result).toEqual(mockPaginatedExecutions);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should pass status filter to service', async () => {
      const filters = new FilterExecutionDto();
      filters.status = 'completed';
      service.findAllExecutions.mockResolvedValue({
        ...mockPaginatedExecutions,
        data: [],
      } as never);

      await controller.findAllExecutions(filters);

      expect(service.findAllExecutions).toHaveBeenCalledWith(filters);
    });

    it('should pass jobType filter to service', async () => {
      const filters = new FilterExecutionDto();
      filters.jobType = 'run_forecast';
      service.findAllExecutions.mockResolvedValue(
        mockPaginatedExecutions as never,
      );

      await controller.findAllExecutions(filters);

      expect(service.findAllExecutions).toHaveBeenCalledWith(
        expect.objectContaining({ jobType: 'run_forecast' }),
      );
    });
  });

  describe('findExecutionById', () => {
    it('should return execution with steps', async () => {
      service.findExecutionById.mockResolvedValue(
        mockExecutionWithSteps as never,
      );

      const result = await controller.findExecutionById(mockExecution.id);

      expect(result).toEqual(mockExecutionWithSteps);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].stepName).toBe('load_data');
    });

    it('should propagate NotFoundException', async () => {
      service.findExecutionById.mockRejectedValue(
        new NotFoundException('Execution with id not-found not found'),
      );

      await expect(
        controller.findExecutionById('not-found'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findMetrics', () => {
    it('should return paginated metrics', async () => {
      const filters = new FilterMetricsDto();
      service.findMetrics.mockResolvedValue(mockPaginatedMetrics as never);

      const result = await controller.findMetrics(filters);

      expect(result).toEqual(mockPaginatedMetrics);
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as ForecastMetric).mape).toBe(5.2);
    });

    it('should pass metric filters to service', async () => {
      const filters = new FilterMetricsDto();
      filters.modelName = 'ETS';
      filters.classeAbc = 'A';
      service.findMetrics.mockResolvedValue({
        ...mockPaginatedMetrics,
        data: [],
      } as never);

      await controller.findMetrics(filters);

      expect(service.findMetrics).toHaveBeenCalledWith(
        expect.objectContaining({ modelName: 'ETS', classeAbc: 'A' }),
      );
    });
  });

  describe('findModels', () => {
    it('should return paginated models', async () => {
      const filters = new FilterModelsDto();
      service.findModels.mockResolvedValue(mockPaginatedModels as never);

      const result = await controller.findModels(filters);

      expect(result).toEqual(mockPaginatedModels);
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as ForecastModelMeta).isChampion).toBe(true);
    });

    it('should filter by champion status', async () => {
      const filters = new FilterModelsDto();
      filters.isChampion = true;
      service.findModels.mockResolvedValue(mockPaginatedModels as never);

      await controller.findModels(filters);

      expect(service.findModels).toHaveBeenCalledWith(
        expect.objectContaining({ isChampion: true }),
      );
    });
  });

  describe('findCurrentChampion', () => {
    const mockChampion = {
      id: 'champion-1',
      tipoModelo: 'TFT',
      versao: 3,
      isChampion: true,
      metricasTreino: { avg_mape: 5.2 },
      treinadoEm: new Date('2026-02-26'),
      createdAt: new Date('2026-02-26'),
    };

    it('should return current champion', async () => {
      service.findCurrentChampion.mockResolvedValue(mockChampion as never);

      const result = await controller.findCurrentChampion({ tipoModelo: 'TFT' });

      expect(result).toEqual(mockChampion);
      expect(service.findCurrentChampion).toHaveBeenCalledWith('TFT');
    });

    it('should work without tipoModelo', async () => {
      service.findCurrentChampion.mockResolvedValue(mockChampion as never);

      const result = await controller.findCurrentChampion({});

      expect(result).toEqual(mockChampion);
      expect(service.findCurrentChampion).toHaveBeenCalledWith(undefined);
    });

    it('should propagate NotFoundException', async () => {
      service.findCurrentChampion.mockRejectedValue(
        new NotFoundException('No champion model found for type TFT'),
      );

      await expect(
        controller.findCurrentChampion({ tipoModelo: 'TFT' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findChampionHistory', () => {
    const mockHistory = [
      {
        id: 'model-1',
        tipoModelo: 'TFT',
        versao: 3,
        isChampion: true,
        metricasTreino: { avg_mape: 5.2 },
        treinadoEm: new Date('2026-02-26'),
        createdAt: new Date('2026-02-26'),
      },
    ];

    it('should return champion history', async () => {
      service.findChampionHistory.mockResolvedValue(mockHistory as never);

      const result = await controller.findChampionHistory({ tipoModelo: 'TFT' });

      expect(result).toEqual(mockHistory);
      expect(service.findChampionHistory).toHaveBeenCalledWith('TFT');
    });

    it('should work without tipoModelo', async () => {
      service.findChampionHistory.mockResolvedValue([] as never);

      const result = await controller.findChampionHistory({});

      expect(result).toEqual([]);
      expect(service.findChampionHistory).toHaveBeenCalledWith(undefined);
    });
  });
});
