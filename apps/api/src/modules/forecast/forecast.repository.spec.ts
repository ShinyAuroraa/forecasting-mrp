import { Test, TestingModule } from '@nestjs/testing';
import { ForecastRepository } from './forecast.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { ExecuteForecastDto } from './dto/execute-forecast.dto';
import { FilterExecutionDto } from './dto/filter-execution.dto';
import { FilterMetricsDto } from './dto/filter-metrics.dto';
import { FilterModelsDto } from './dto/filter-models.dto';
import {
  ExecutionStatus,
  ForecastExecution,
  ForecastJobType,
} from './forecast.interfaces';

describe('ForecastRepository', () => {
  let repository: ForecastRepository;
  let mockExecDelegate: Record<string, jest.Mock>;
  let mockMetricDelegate: Record<string, jest.Mock>;
  let mockModelDelegate: Record<string, jest.Mock>;

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

  beforeEach(async () => {
    mockExecDelegate = {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    };

    mockMetricDelegate = {
      findMany: jest.fn(),
      count: jest.fn(),
    };

    mockModelDelegate = {
      findMany: jest.fn(),
      count: jest.fn(),
    };

    const mockPrisma = {
      forecastExecution: mockExecDelegate,
      forecastMetric: mockMetricDelegate,
      forecastModel: mockModelDelegate,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForecastRepository,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    repository = module.get<ForecastRepository>(ForecastRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('createExecution', () => {
    it('should create execution with defaults', async () => {
      const dto: ExecuteForecastDto = {
        jobType: 'run_forecast',
      } as ExecuteForecastDto;
      mockExecDelegate.create.mockResolvedValue(mockExecution);

      const result = await repository.createExecution(dto);

      expect(result).toEqual(mockExecution);
      expect(mockExecDelegate.create).toHaveBeenCalledWith({
        data: {
          jobType: 'run_forecast',
          status: ExecutionStatus.QUEUED,
          produtoIds: null,
          modelo: null,
          horizonteSemanas: 13,
          holdoutWeeks: 13,
          forceRetrain: false,
          progress: 0,
        },
      });
    });

    it('should create execution with all fields', async () => {
      const dto: ExecuteForecastDto = {
        jobType: 'train_model',
        produtoIds: ['p1', 'p2'],
        modelo: 'ETS',
        horizonteSemanas: 26,
        holdoutWeeks: 8,
        forceRetrain: true,
      } as ExecuteForecastDto;
      mockExecDelegate.create.mockResolvedValue({
        ...mockExecution,
        jobType: ForecastJobType.TRAIN_MODEL,
      });

      await repository.createExecution(dto);

      expect(mockExecDelegate.create).toHaveBeenCalledWith({
        data: {
          jobType: 'train_model',
          status: ExecutionStatus.QUEUED,
          produtoIds: ['p1', 'p2'],
          modelo: 'ETS',
          horizonteSemanas: 26,
          holdoutWeeks: 8,
          forceRetrain: true,
          progress: 0,
        },
      });
    });
  });

  describe('findAllExecutions', () => {
    it('should query with default pagination', async () => {
      const filters = new FilterExecutionDto();
      mockExecDelegate.findMany.mockResolvedValue([mockExecution]);
      mockExecDelegate.count.mockResolvedValue(1);

      const result = await repository.findAllExecutions(filters);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(50);
      expect(mockExecDelegate.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 50,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by status', async () => {
      const filters = new FilterExecutionDto();
      filters.status = 'completed';
      mockExecDelegate.findMany.mockResolvedValue([]);
      mockExecDelegate.count.mockResolvedValue(0);

      await repository.findAllExecutions(filters);

      expect(mockExecDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'completed' },
        }),
      );
    });

    it('should filter by jobType', async () => {
      const filters = new FilterExecutionDto();
      filters.jobType = 'run_forecast';
      mockExecDelegate.findMany.mockResolvedValue([]);
      mockExecDelegate.count.mockResolvedValue(0);

      await repository.findAllExecutions(filters);

      expect(mockExecDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { jobType: 'run_forecast' },
        }),
      );
    });

    it('should filter by date range', async () => {
      const filters = new FilterExecutionDto();
      filters.from = '2026-01-01';
      filters.to = '2026-12-31';
      mockExecDelegate.findMany.mockResolvedValue([]);
      mockExecDelegate.count.mockResolvedValue(0);

      await repository.findAllExecutions(filters);

      expect(mockExecDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            createdAt: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-12-31'),
            },
          },
        }),
      );
    });

    it('should apply custom pagination', async () => {
      const filters = new FilterExecutionDto();
      filters.page = 3;
      filters.limit = 10;
      filters.sortBy = 'status';
      filters.sortOrder = 'asc';
      mockExecDelegate.findMany.mockResolvedValue([]);
      mockExecDelegate.count.mockResolvedValue(25);

      const result = await repository.findAllExecutions(filters);

      expect(mockExecDelegate.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 20,
        take: 10,
        orderBy: { status: 'asc' },
      });
      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.hasNext).toBe(false);
      expect(result.meta.hasPrev).toBe(true);
    });
  });

  describe('findExecutionById', () => {
    it('should find execution with steps', async () => {
      const executionWithSteps = {
        ...mockExecution,
        steps: [{ id: 's1', step: 1, stepName: 'load_data' }],
      };
      mockExecDelegate.findUnique.mockResolvedValue(executionWithSteps);

      const result = await repository.findExecutionById(mockExecution.id);

      expect(result).toEqual(executionWithSteps);
      expect(mockExecDelegate.findUnique).toHaveBeenCalledWith({
        where: { id: mockExecution.id },
        include: { steps: { orderBy: { step: 'asc' } } },
      });
    });

    it('should return null when not found', async () => {
      mockExecDelegate.findUnique.mockResolvedValue(null);

      const result = await repository.findExecutionById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findMetrics', () => {
    it('should query with default filters', async () => {
      const filters = new FilterMetricsDto();
      mockMetricDelegate.findMany.mockResolvedValue([]);
      mockMetricDelegate.count.mockResolvedValue(0);

      const result = await repository.findMetrics(filters);

      expect(result.data).toHaveLength(0);
      expect(mockMetricDelegate.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 50,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by executionId and modelName', async () => {
      const filters = new FilterMetricsDto();
      filters.executionId = '123e4567-e89b-12d3-a456-426614174000';
      filters.modelName = 'ETS';
      mockMetricDelegate.findMany.mockResolvedValue([]);
      mockMetricDelegate.count.mockResolvedValue(0);

      await repository.findMetrics(filters);

      expect(mockMetricDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            executionId: '123e4567-e89b-12d3-a456-426614174000',
            modelName: 'ETS',
          },
        }),
      );
    });

    it('should filter by classeAbc and isBaseline', async () => {
      const filters = new FilterMetricsDto();
      filters.classeAbc = 'A';
      filters.isBaseline = false;
      mockMetricDelegate.findMany.mockResolvedValue([]);
      mockMetricDelegate.count.mockResolvedValue(0);

      await repository.findMetrics(filters);

      expect(mockMetricDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { classeAbc: 'A', isBaseline: false },
        }),
      );
    });

    it('should filter by produtoId', async () => {
      const filters = new FilterMetricsDto();
      filters.produtoId = 'p1';
      mockMetricDelegate.findMany.mockResolvedValue([]);
      mockMetricDelegate.count.mockResolvedValue(0);

      await repository.findMetrics(filters);

      expect(mockMetricDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { produtoId: 'p1' },
        }),
      );
    });
  });

  describe('findModels', () => {
    it('should query with default filters', async () => {
      const filters = new FilterModelsDto();
      mockModelDelegate.findMany.mockResolvedValue([]);
      mockModelDelegate.count.mockResolvedValue(0);

      const result = await repository.findModels(filters);

      expect(result.data).toHaveLength(0);
      expect(mockModelDelegate.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 50,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by modelName', async () => {
      const filters = new FilterModelsDto();
      filters.modelName = 'NAIVE';
      mockModelDelegate.findMany.mockResolvedValue([]);
      mockModelDelegate.count.mockResolvedValue(0);

      await repository.findModels(filters);

      expect(mockModelDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { modelName: 'NAIVE' },
        }),
      );
    });

    it('should filter by champion status', async () => {
      const filters = new FilterModelsDto();
      filters.isChampion = true;
      mockModelDelegate.findMany.mockResolvedValue([]);
      mockModelDelegate.count.mockResolvedValue(0);

      await repository.findModels(filters);

      expect(mockModelDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isChampion: true },
        }),
      );
    });
  });
});
