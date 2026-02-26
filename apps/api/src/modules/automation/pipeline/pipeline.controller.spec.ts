import { Test, TestingModule } from '@nestjs/testing';

import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import type { PipelineExecution } from './pipeline.types';

describe('PipelineController', () => {
  let controller: PipelineController;
  let service: jest.Mocked<PipelineService>;

  const mockExecution: PipelineExecution = {
    id: 'exec-1',
    status: 'PENDING',
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    stepsCompleted: 0,
    stepsTotal: 7,
    resultSummary: null,
    createdAt: new Date('2026-02-28T06:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PipelineController],
      providers: [
        {
          provide: PipelineService,
          useValue: {
            triggerPipeline: jest.fn(),
            getStatus: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            onProgress: jest.fn(),
            onComplete: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PipelineController>(PipelineController);
    service = module.get(PipelineService);
  });

  describe('triggerPipeline', () => {
    it('should trigger pipeline with user ID from JWT', async () => {
      service.triggerPipeline.mockResolvedValue(mockExecution);
      const mockReq = { user: { sub: 'user-1' } } as any;

      const result = await controller.triggerPipeline(mockReq);

      expect(result).toEqual(mockExecution);
      expect(service.triggerPipeline).toHaveBeenCalledWith('user-1');
    });

    it('should fallback to unknown when no JWT user', async () => {
      service.triggerPipeline.mockResolvedValue(mockExecution);
      const mockReq = {} as any;

      await controller.triggerPipeline(mockReq);

      expect(service.triggerPipeline).toHaveBeenCalledWith('unknown');
    });
  });

  describe('getStatus', () => {
    it('should return current pipeline status', async () => {
      service.getStatus.mockResolvedValue(mockExecution);

      const result = await controller.getStatus();

      expect(result).toEqual(mockExecution);
    });

    it('should return null when no pipeline running', async () => {
      service.getStatus.mockResolvedValue(null);

      const result = await controller.getStatus();

      expect(result).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should return paginated history', async () => {
      const historyResult = {
        data: [mockExecution],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false },
      };
      service.findAll.mockResolvedValue(historyResult);

      const result = await controller.getHistory({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return execution detail', async () => {
      const detail = { ...mockExecution, steps: [] };
      service.findById.mockResolvedValue(detail);

      const result = await controller.findById('exec-1');

      expect(result.id).toBe('exec-1');
      expect(service.findById).toHaveBeenCalledWith('exec-1');
    });
  });

  describe('progress (SSE)', () => {
    it('should return Observable that subscribes to progress and completion', (done) => {
      const mockUnsubProgress = jest.fn();
      const mockUnsubComplete = jest.fn();
      service.onProgress.mockReturnValue(mockUnsubProgress);
      service.onComplete.mockReturnValue(mockUnsubComplete);

      const observable = controller.progress('exec-1');

      expect(observable).toBeDefined();

      const subscription = observable.subscribe({
        next: (event) => {
          expect(event.data).toEqual(
            expect.objectContaining({ stepId: 'fetch-data' }),
          );
        },
        complete: () => {
          done();
        },
      });

      // Simulate progress event via the registered callback
      const progressCallback = service.onProgress.mock.calls[0][1];
      progressCallback({
        executionId: 'exec-1',
        stepId: 'fetch-data',
        stepName: 'Buscar dados',
        stepOrder: 1,
        totalSteps: 7,
        status: 'RUNNING',
        timestamp: new Date().toISOString(),
      });

      // Simulate completion via the registered callback
      const completeCallback = service.onComplete.mock.calls[0][1];
      completeCallback();

      subscription.unsubscribe();
      expect(mockUnsubProgress).toHaveBeenCalled();
      expect(mockUnsubComplete).toHaveBeenCalled();
    });
  });
});
