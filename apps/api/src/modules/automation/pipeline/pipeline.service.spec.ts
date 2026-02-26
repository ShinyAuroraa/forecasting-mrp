import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { PipelineService } from './pipeline.service';
import { PipelineRepository } from './pipeline.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { DailySummaryService } from '../emails/daily-summary.service';

describe('PipelineService', () => {
  let service: PipelineService;
  let repository: jest.Mocked<PipelineRepository>;
  let prisma: any;
  let queue: any;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockQueue = {
      add: jest.fn().mockResolvedValue({}),
      getRepeatableJobs: jest.fn().mockResolvedValue([]),
      removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineService,
        {
          provide: PipelineRepository,
          useValue: {
            createExecution: jest.fn(),
            updateExecution: jest.fn(),
            createStepLog: jest.fn(),
            updateStepLog: jest.fn(),
            checkRunningPipeline: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            getLastExecution: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            configSistema: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
            },
          },
        },
        {
          provide: getQueueToken('daily-pipeline'),
          useValue: mockQueue,
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: DailySummaryService,
          useValue: {
            sendSummary: jest.fn().mockResolvedValue({ success: true, messageId: null, recipients: [], error: null }),
            sendBriefing: jest.fn().mockResolvedValue({ success: true, messageId: null, recipients: [], error: null }),
          },
        },
      ],
    }).compile();

    service = module.get<PipelineService>(PipelineService);
    repository = module.get(PipelineRepository);
    prisma = module.get(PrismaService);
    queue = module.get(getQueueToken('daily-pipeline'));
    eventEmitter = module.get(EventEmitter2);
  });

  // ────────────────────────────────────────────────────────────────
  // Configuration (AC-16, AC-17)
  // ────────────────────────────────────────────────────────────────

  describe('getConfig', () => {
    it('should return default config when nothing stored', async () => {
      prisma.configSistema.findUnique.mockResolvedValue(null);

      const config = await service.getConfig();

      expect(config.cron).toBe('0 6 * * 1-5');
      expect(config.steps['fetch-data'].enabled).toBe(true);
      expect(config.steps.mrp.enabled).toBe(true);
    });

    it('should return stored config', async () => {
      prisma.configSistema.findUnique.mockResolvedValue({
        chave: 'automacao.pipeline.config',
        valor: {
          cron: '0 7 * * 1-5',
          steps: {
            'fetch-data': { enabled: true },
            'etl': { enabled: false },
            'update-stock': { enabled: false },
            'forecast': { enabled: true },
            'mrp': { enabled: true },
            'alerts': { enabled: true },
            'email': { enabled: false },
          },
        },
      });

      const config = await service.getConfig();

      expect(config.cron).toBe('0 7 * * 1-5');
      expect(config.steps.etl.enabled).toBe(false);
      expect(config.steps.email.enabled).toBe(false);
    });
  });

  describe('saveConfig', () => {
    it('should upsert config and sync repeatable job', async () => {
      prisma.configSistema.upsert.mockResolvedValue({});
      queue.getRepeatableJobs.mockResolvedValue([]);

      const config = {
        cron: '0 7 * * 1-5',
        steps: {
          'fetch-data': { enabled: true },
          'etl': { enabled: true },
          'update-stock': { enabled: true },
          'forecast': { enabled: true },
          'mrp': { enabled: true },
          'alerts': { enabled: true },
          'email': { enabled: true },
        },
      };

      const result = await service.saveConfig(config);

      expect(result).toEqual(config);
      expect(prisma.configSistema.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { chave: 'automacao.pipeline.config' },
        }),
      );
      expect(queue.add).toHaveBeenCalledTimes(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Sync Repeatable Job (AC-16)
  // ────────────────────────────────────────────────────────────────

  describe('syncRepeatableJob', () => {
    it('should remove existing and add new repeatable job', async () => {
      queue.getRepeatableJobs.mockResolvedValue([{ key: 'old-job' }]);

      await service.syncRepeatableJob('0 6 * * 1-5');

      expect(queue.removeRepeatableByKey).toHaveBeenCalledTimes(1);
      expect(queue.add).toHaveBeenCalledWith(
        'daily-pipeline',
        { trigger: 'scheduled' },
        expect.objectContaining({ repeat: { pattern: '0 6 * * 1-5' } }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Trigger (AC-20)
  // ────────────────────────────────────────────────────────────────

  describe('triggerPipeline', () => {
    it('should create execution and queue job', async () => {
      prisma.configSistema.findUnique.mockResolvedValue(null);
      repository.checkRunningPipeline.mockResolvedValue(null);
      repository.createExecution.mockResolvedValue({
        id: 'exec-1',
        createdAt: new Date('2026-02-28T06:00:00Z'),
      } as any);

      const result = await service.triggerPipeline('user-1');

      expect(result.id).toBe('exec-1');
      expect(result.status).toBe('PENDING');
      expect(result.stepsTotal).toBe(7);
      expect(repository.createExecution).toHaveBeenCalledWith(
        expect.objectContaining({ stepsTotal: 7, gatilho: 'MANUAL', createdBy: 'user-1' }),
      );
      expect(queue.add).toHaveBeenCalled();
    });

    it('should filter disabled steps from stepsTotal', async () => {
      prisma.configSistema.findUnique.mockResolvedValue({
        chave: 'automacao.pipeline.config',
        valor: {
          cron: '0 6 * * 1-5',
          steps: {
            'fetch-data': { enabled: true },
            'etl': { enabled: false },
            'update-stock': { enabled: false },
            'forecast': { enabled: true },
            'mrp': { enabled: true },
            'alerts': { enabled: true },
            'email': { enabled: true },
          },
        },
      });
      repository.checkRunningPipeline.mockResolvedValue(null);
      repository.createExecution.mockResolvedValue({
        id: 'exec-2',
        createdAt: new Date(),
      } as any);

      const result = await service.triggerPipeline('user-1');

      expect(result.stepsTotal).toBe(5); // 7 - 2 disabled
    });

    it('should throw ConflictException when pipeline already running', async () => {
      repository.checkRunningPipeline.mockResolvedValue({ id: 'running-1' } as any);

      await expect(service.triggerPipeline()).rejects.toThrow(ConflictException);
    });

    it('should set gatilho AGENDADO when no userId', async () => {
      prisma.configSistema.findUnique.mockResolvedValue(null);
      repository.checkRunningPipeline.mockResolvedValue(null);
      repository.createExecution.mockResolvedValue({
        id: 'exec-3',
        createdAt: new Date(),
      } as any);

      await service.triggerPipeline();

      expect(repository.createExecution).toHaveBeenCalledWith(
        expect.objectContaining({ gatilho: 'AGENDADO' }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Execute Pipeline (AC-9, AC-11, AC-12, AC-13, AC-14, AC-15)
  // ────────────────────────────────────────────────────────────────

  describe('executePipeline', () => {
    it('should execute all steps and mark CONCLUIDO', async () => {
      prisma.configSistema.findUnique.mockResolvedValue(null);
      repository.updateExecution.mockResolvedValue({} as any);
      let stepCount = 0;
      repository.createStepLog.mockImplementation(async () => {
        stepCount++;
        return { id: BigInt(stepCount) } as any;
      });
      repository.updateStepLog.mockResolvedValue({} as any);

      await service.executePipeline('exec-1');

      expect(repository.updateExecution).toHaveBeenCalledWith(
        'exec-1', 'EXECUTANDO', expect.any(Object),
      );
      expect(repository.createStepLog).toHaveBeenCalledTimes(7);
      expect(repository.updateStepLog).toHaveBeenCalledTimes(7);

      const lastUpdate = repository.updateExecution.mock.calls.at(-1);
      expect(lastUpdate?.[1]).toBe('CONCLUIDO');
    });

    it('should skip disabled steps', async () => {
      prisma.configSistema.findUnique.mockResolvedValue({
        chave: 'automacao.pipeline.config',
        valor: {
          cron: '0 6 * * 1-5',
          steps: {
            'fetch-data': { enabled: false },
            'etl': { enabled: false },
            'update-stock': { enabled: false },
            'forecast': { enabled: true },
            'mrp': { enabled: true },
            'alerts': { enabled: true },
            'email': { enabled: true },
          },
        },
      });
      repository.updateExecution.mockResolvedValue({} as any);
      let stepCount = 0;
      repository.createStepLog.mockImplementation(async () => {
        stepCount++;
        return { id: BigInt(stepCount) } as any;
      });
      repository.updateStepLog.mockResolvedValue({} as any);

      await service.executePipeline('exec-2');

      // Only 4 enabled steps should execute
      expect(repository.createStepLog).toHaveBeenCalledTimes(4);
    });

    it('should mark PARCIAL if some steps fail (AC-13 graceful degradation)', async () => {
      prisma.configSistema.findUnique.mockResolvedValue(null);
      repository.updateExecution.mockResolvedValue({} as any);
      let stepCount = 0;
      repository.createStepLog.mockImplementation(async () => {
        stepCount++;
        return { id: BigInt(stepCount) } as any;
      });
      repository.updateStepLog.mockResolvedValue({} as any);

      // Make fetch-data step fail
      jest.spyOn(service as any, 'executeStep').mockImplementation(
        async (stepId: string) => {
          if (stepId === 'fetch-data') throw new Error('Email fetch failed');
        },
      );

      await service.executePipeline('exec-3');

      const lastUpdate = repository.updateExecution.mock.calls.at(-1);
      expect(lastUpdate?.[1]).toBe('PARCIAL');

      // Check that dependent steps (etl, update-stock) were SKIPPED
      const stepLogUpdates = repository.updateStepLog.mock.calls;
      const skippedCalls = stepLogUpdates.filter(
        (call) => call[1]?.status === 'SKIPPED',
      );
      // etl and update-stock depend on fetch-data, and email depends on alerts
      // but fetch-data failure -> etl skipped -> update-stock skipped
      expect(skippedCalls.length).toBe(2); // etl + update-stock
    });

    it('should continue after forecast failure and still run alerts (AC-14)', async () => {
      prisma.configSistema.findUnique.mockResolvedValue(null);
      repository.updateExecution.mockResolvedValue({} as any);
      let stepCount = 0;
      repository.createStepLog.mockImplementation(async () => {
        stepCount++;
        return { id: BigInt(stepCount) } as any;
      });
      repository.updateStepLog.mockResolvedValue({} as any);

      jest.spyOn(service as any, 'executeStep').mockImplementation(
        async (stepId: string) => {
          if (stepId === 'forecast') throw new Error('Forecast inference failed');
        },
      );

      await service.executePipeline('exec-4');

      // forecast has no dependencies on it from mrp/alerts (they have empty dependsOn)
      // So mrp and alerts should still run
      const completedCalls = repository.updateStepLog.mock.calls.filter(
        (call) => call[1]?.status === 'COMPLETED',
      );
      // fetch-data, etl, update-stock, mrp, alerts = 5 completed
      // forecast = 1 failed
      // email depends on alerts, alerts completed, so email = completed = 6 total
      expect(completedCalls.length).toBe(6);
    });

    it('should emit progress events for each step', async () => {
      prisma.configSistema.findUnique.mockResolvedValue(null);
      repository.updateExecution.mockResolvedValue({} as any);
      let stepCount = 0;
      repository.createStepLog.mockImplementation(async () => {
        stepCount++;
        return { id: BigInt(stepCount) } as any;
      });
      repository.updateStepLog.mockResolvedValue({} as any);

      await service.executePipeline('exec-5');

      // Each step emits RUNNING + COMPLETED = 14 events for 7 steps
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'pipeline.progress',
        expect.objectContaining({ executionId: 'exec-5' }),
      );
      // At least 14 calls (7 RUNNING + 7 COMPLETED)
      expect(eventEmitter.emit).toHaveBeenCalledTimes(14);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Query (AC-21, AC-22)
  // ────────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('should return running pipeline if available', async () => {
      repository.checkRunningPipeline.mockResolvedValue({
        id: 'running-1',
        status: 'EXECUTANDO',
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
        parametros: { pipelineType: 'DAILY', stepsTotal: 7, stepsCompleted: 3 },
        resultadoResumo: null,
        createdAt: new Date(),
      } as any);

      const result = await service.getStatus();

      expect(result?.id).toBe('running-1');
      expect(result?.status).toBe('RUNNING');
    });

    it('should return last execution when nothing is running', async () => {
      repository.checkRunningPipeline.mockResolvedValue(null);
      repository.getLastExecution.mockResolvedValue({
        id: 'last-1',
        status: 'CONCLUIDO',
        startedAt: new Date('2026-02-28T06:00:00Z'),
        completedAt: new Date('2026-02-28T06:15:00Z'),
        errorMessage: null,
        parametros: { pipelineType: 'DAILY', stepsTotal: 7, stepsCompleted: 7 },
        resultadoResumo: null,
        createdAt: new Date(),
      } as any);

      const result = await service.getStatus();

      expect(result?.id).toBe('last-1');
      expect(result?.status).toBe('COMPLETED');
    });

    it('should return null when no executions exist', async () => {
      repository.checkRunningPipeline.mockResolvedValue(null);
      repository.getLastExecution.mockResolvedValue(null);

      const result = await service.getStatus();

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should delegate to repository', async () => {
      const mockResult = {
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false },
      };
      repository.findAll.mockResolvedValue(mockResult);

      const result = await service.findAll({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });

      expect(result).toEqual(mockResult);
    });
  });

  describe('findById', () => {
    it('should return execution detail', async () => {
      const mockDetail = {
        id: 'exec-1',
        status: 'COMPLETED' as const,
        steps: [],
        stepsCompleted: 7,
        stepsTotal: 7,
        startedAt: new Date(),
        completedAt: new Date(),
        errorMessage: null,
        resultSummary: null,
        createdAt: new Date(),
      };
      repository.findById.mockResolvedValue(mockDetail);

      const result = await service.findById('exec-1');

      expect(result.id).toBe('exec-1');
    });

    it('should throw NotFoundException when not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Progress Subscription (AC-10, AC-19)
  // ────────────────────────────────────────────────────────────────

  describe('onProgress', () => {
    it('should register and call subscriber on progress events', () => {
      const callback = jest.fn();
      service.onProgress('exec-1', callback);

      // Simulate progress emission by calling private emitProgress
      (service as any).emitProgress('exec-1', { id: 'fetch-data', name: 'Test', order: 1 }, 7, 'RUNNING');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          executionId: 'exec-1',
          stepId: 'fetch-data',
          status: 'RUNNING',
        }),
      );
    });

    it('should unsubscribe correctly', () => {
      const callback = jest.fn();
      const unsubscribe = service.onProgress('exec-1', callback);

      unsubscribe();

      (service as any).emitProgress('exec-1', { id: 'fetch-data', name: 'Test', order: 1 }, 7, 'RUNNING');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('onComplete', () => {
    it('should register and call completion subscriber', () => {
      const callback = jest.fn();
      service.onComplete('exec-1', callback);

      (service as any).emitCompletion('exec-1');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe correctly', () => {
      const callback = jest.fn();
      const unsubscribe = service.onComplete('exec-1', callback);

      unsubscribe();

      (service as any).emitCompletion('exec-1');

      expect(callback).not.toHaveBeenCalled();
    });

    it('should clean up progress subscribers on completion', () => {
      const progressCb = jest.fn();
      service.onProgress('exec-1', progressCb);

      (service as any).emitCompletion('exec-1');

      // After completion, progress events should not reach the subscriber
      (service as any).emitProgress('exec-1', { id: 'fetch-data', name: 'Test', order: 1 }, 7, 'RUNNING');
      expect(progressCb).not.toHaveBeenCalled();
    });
  });
});
