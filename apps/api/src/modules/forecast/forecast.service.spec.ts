import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ForecastService } from './forecast.service';
import { ForecastRepository } from './forecast.repository';
import { ExecuteForecastDto } from './dto/execute-forecast.dto';
import { FilterExecutionDto } from './dto/filter-execution.dto';
import { FilterMetricsDto } from './dto/filter-metrics.dto';
import { FilterModelsDto } from './dto/filter-models.dto';
import {
  ExecutionStatus,
  ForecastExecution,
  ExecutionWithSteps,
  ForecastJobType,
} from './forecast.interfaces';

describe('ForecastService', () => {
  let service: ForecastService;
  let repository: jest.Mocked<ForecastRepository>;

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

  const mockPaginatedResult = {
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForecastService,
        {
          provide: ForecastRepository,
          useValue: {
            createExecution: jest.fn(),
            findAllExecutions: jest.fn(),
            findExecutionById: jest.fn(),
            findMetrics: jest.fn(),
            findModels: jest.fn(),
            findCurrentChampion: jest.fn(),
            findChampionHistory: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ForecastService>(ForecastService);
    repository = module.get(ForecastRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('triggerExecution', () => {
    it('should create and return execution', async () => {
      const dto = { jobType: 'run_forecast' } as ExecuteForecastDto;
      repository.createExecution.mockResolvedValue(mockExecution);

      const result = await service.triggerExecution(dto);

      expect(result).toEqual(mockExecution);
      expect(repository.createExecution).toHaveBeenCalledWith(dto);
    });

    it('should pass all DTO fields to repository', async () => {
      const dto = {
        jobType: 'train_model',
        produtoIds: ['p1', 'p2'],
        modelo: 'ETS',
        forceRetrain: true,
      } as ExecuteForecastDto;
      const trainExecution: ForecastExecution = {
        ...mockExecution,
        jobType: ForecastJobType.TRAIN_MODEL,
        produtoIds: ['p1', 'p2'],
        modelo: 'ETS',
        forceRetrain: true,
      };
      repository.createExecution.mockResolvedValue(trainExecution);

      await service.triggerExecution(dto);

      expect(repository.createExecution).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAllExecutions', () => {
    it('should return paginated executions', async () => {
      const filters = new FilterExecutionDto();
      repository.findAllExecutions.mockResolvedValue(
        mockPaginatedResult as never,
      );

      const result = await service.findAllExecutions(filters);

      expect(result).toEqual(mockPaginatedResult);
      expect(result.data).toHaveLength(1);
    });

    it('should pass filters to repository', async () => {
      const filters = new FilterExecutionDto();
      filters.status = 'completed';
      repository.findAllExecutions.mockResolvedValue(
        mockPaginatedResult as never,
      );

      await service.findAllExecutions(filters);

      expect(repository.findAllExecutions).toHaveBeenCalledWith(filters);
    });
  });

  describe('findExecutionById', () => {
    it('should return execution with steps', async () => {
      repository.findExecutionById.mockResolvedValue(mockExecutionWithSteps);

      const result = await service.findExecutionById(mockExecution.id);

      expect(result).toEqual(mockExecutionWithSteps);
      expect(result.steps).toHaveLength(1);
    });

    it('should throw NotFoundException when not found', async () => {
      repository.findExecutionById.mockResolvedValue(null);

      await expect(service.findExecutionById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should include execution id in error message', async () => {
      repository.findExecutionById.mockResolvedValue(null);

      await expect(service.findExecutionById('abc-123')).rejects.toThrow(
        'Execution with id abc-123 not found',
      );
    });
  });

  describe('findMetrics', () => {
    it('should return paginated metrics', async () => {
      const filters = new FilterMetricsDto();
      const mockMetrics = {
        data: [{ id: 'm1', modelName: 'NAIVE', mape: 5.2 }],
        meta: {
          total: 1,
          page: 1,
          limit: 50,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };
      repository.findMetrics.mockResolvedValue(mockMetrics as never);

      const result = await service.findMetrics(filters);

      expect(result).toEqual(mockMetrics);
    });

    it('should pass filters to repository', async () => {
      const filters = new FilterMetricsDto();
      filters.executionId = '123e4567-e89b-12d3-a456-426614174000';
      filters.modelName = 'ETS';
      repository.findMetrics.mockResolvedValue({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      } as never);

      await service.findMetrics(filters);

      expect(repository.findMetrics).toHaveBeenCalledWith(filters);
    });
  });

  describe('findModels', () => {
    it('should return paginated models', async () => {
      const filters = new FilterModelsDto();
      const mockModels = {
        data: [{ id: 'mod-1', modelName: 'NAIVE', isChampion: true }],
        meta: {
          total: 1,
          page: 1,
          limit: 50,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };
      repository.findModels.mockResolvedValue(mockModels as never);

      const result = await service.findModels(filters);

      expect(result).toEqual(mockModels);
    });

    it('should pass champion filter to repository', async () => {
      const filters = new FilterModelsDto();
      filters.isChampion = true;
      repository.findModels.mockResolvedValue({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      } as never);

      await service.findModels(filters);

      expect(repository.findModels).toHaveBeenCalledWith(
        expect.objectContaining({ isChampion: true }),
      );
    });
  });

  describe('findCurrentChampion', () => {
    const mockChampionData = {
      id: 'champion-1',
      tipoModelo: 'TFT',
      versao: 3,
      isChampion: true,
      metricasTreino: { avg_mape: 5.2 },
      treinadoEm: new Date('2026-02-26'),
      createdAt: new Date('2026-02-26'),
    };

    it('should return champion when found', async () => {
      repository.findCurrentChampion.mockResolvedValue(mockChampionData as never);

      const result = await service.findCurrentChampion('TFT');

      expect(result).toEqual(mockChampionData);
      expect(repository.findCurrentChampion).toHaveBeenCalledWith('TFT');
    });

    it('should throw NotFoundException when no champion', async () => {
      repository.findCurrentChampion.mockResolvedValue(null);

      await expect(service.findCurrentChampion('TFT')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should include tipoModelo in error message', async () => {
      repository.findCurrentChampion.mockResolvedValue(null);

      await expect(service.findCurrentChampion('TFT')).rejects.toThrow(
        'No champion model found for type TFT',
      );
    });

    it('should work without tipoModelo filter', async () => {
      repository.findCurrentChampion.mockResolvedValue(mockChampionData as never);

      const result = await service.findCurrentChampion();

      expect(result).toEqual(mockChampionData);
      expect(repository.findCurrentChampion).toHaveBeenCalledWith(undefined);
    });
  });

  describe('findChampionHistory', () => {
    const mockHistory = [
      {
        id: 'model-1',
        tipoModelo: 'TFT',
        versao: 3,
        isChampion: true,
        metricasTreino: { avg_mape: 5.2, promotion_log: { promoted: true } },
        treinadoEm: new Date('2026-02-26'),
        createdAt: new Date('2026-02-26'),
      },
      {
        id: 'model-2',
        tipoModelo: 'TFT',
        versao: 2,
        isChampion: false,
        metricasTreino: { avg_mape: 8.1, promotion_log: { promoted: true } },
        treinadoEm: new Date('2026-01-26'),
        createdAt: new Date('2026-01-26'),
      },
    ];

    it('should return promotion history', async () => {
      repository.findChampionHistory.mockResolvedValue(mockHistory as never);

      const result = await service.findChampionHistory('TFT');

      expect(result).toEqual(mockHistory);
      expect(result).toHaveLength(2);
      expect(repository.findChampionHistory).toHaveBeenCalledWith('TFT', 10);
    });

    it('should pass custom limit', async () => {
      repository.findChampionHistory.mockResolvedValue([] as never);

      await service.findChampionHistory('ETS', 5);

      expect(repository.findChampionHistory).toHaveBeenCalledWith('ETS', 5);
    });

    it('should return empty array when no history', async () => {
      repository.findChampionHistory.mockResolvedValue([] as never);

      const result = await service.findChampionHistory('CROSTON');

      expect(result).toEqual([]);
    });
  });
});
