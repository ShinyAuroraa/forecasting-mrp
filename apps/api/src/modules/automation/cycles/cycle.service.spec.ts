import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';

import { CycleService } from './cycle.service';
import { CycleRepository } from './cycle.repository';
import { PrismaService } from '../../../prisma/prisma.service';

describe('CycleService', () => {
  let service: CycleService;
  let repository: jest.Mocked<CycleRepository>;
  let prisma: any;
  let queue: any;

  beforeEach(async () => {
    const mockQueue = {
      add: jest.fn().mockResolvedValue({}),
      getRepeatableJobs: jest.fn().mockResolvedValue([]),
      removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CycleService,
        {
          provide: CycleRepository,
          useValue: {
            createExecution: jest.fn(),
            updateExecution: jest.fn(),
            createStepLog: jest.fn(),
            updateStepLog: jest.fn(),
            checkRunningCycle: jest.fn(),
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
          provide: getQueueToken('cycles'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<CycleService>(CycleService);
    repository = module.get(CycleRepository);
    prisma = module.get(PrismaService);
    queue = module.get(getQueueToken('cycles'));
  });

  // ────────────────────────────────────────────────────────────────
  // Schedule Config (AC-5, AC-6)
  // ────────────────────────────────────────────────────────────────

  describe('getScheduleConfig', () => {
    it('should return default schedules when no config stored', async () => {
      prisma.configSistema.findUnique.mockResolvedValue(null);

      const config = await service.getScheduleConfig();

      expect(config).toEqual({
        daily: '0 6 * * *',
        weekly: '0 3 * * 1',
        monthly: '0 2 1 * *',
      });
    });

    it('should return stored schedules', async () => {
      prisma.configSistema.findUnique.mockResolvedValue({
        chave: 'automacao.cycles.schedule',
        valor: { daily: '0 5 * * *', weekly: '0 4 * * 2', monthly: '0 1 15 * *' },
      });

      const config = await service.getScheduleConfig();

      expect(config).toEqual({
        daily: '0 5 * * *',
        weekly: '0 4 * * 2',
        monthly: '0 1 15 * *',
      });
    });
  });

  describe('saveScheduleConfig', () => {
    it('should upsert config and sync repeatable jobs', async () => {
      prisma.configSistema.upsert.mockResolvedValue({});
      queue.getRepeatableJobs.mockResolvedValue([]);

      const config = { daily: '0 7 * * *', weekly: '0 3 * * 1', monthly: '0 2 1 * *' };
      const result = await service.saveScheduleConfig(config);

      expect(result).toEqual(config);
      expect(prisma.configSistema.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { chave: 'automacao.cycles.schedule' },
        }),
      );
      expect(queue.add).toHaveBeenCalledTimes(3);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Sync Repeatable Jobs (AC-7)
  // ────────────────────────────────────────────────────────────────

  describe('syncRepeatableJobs', () => {
    it('should remove existing and add new repeatable jobs', async () => {
      queue.getRepeatableJobs.mockResolvedValue([
        { key: 'old-job-1' },
        { key: 'old-job-2' },
      ]);

      await service.syncRepeatableJobs({
        daily: '0 6 * * *',
        weekly: '0 3 * * 1',
        monthly: '0 2 1 * *',
      });

      expect(queue.removeRepeatableByKey).toHaveBeenCalledTimes(2);
      expect(queue.add).toHaveBeenCalledTimes(3);
      expect(queue.add).toHaveBeenCalledWith(
        'cycle-daily',
        { cycleType: 'DAILY' },
        expect.objectContaining({ repeat: { pattern: '0 6 * * *' } }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Trigger (AC-10)
  // ────────────────────────────────────────────────────────────────

  describe('triggerCycle', () => {
    it('should create execution and queue job for DAILY', async () => {
      repository.checkRunningCycle.mockResolvedValue(null);
      repository.createExecution.mockResolvedValue({
        id: 'exec-1',
        createdAt: new Date('2026-02-28T06:00:00Z'),
      } as any);

      const result = await service.triggerCycle('DAILY', 'user-1');

      expect(result.id).toBe('exec-1');
      expect(result.type).toBe('DAILY');
      expect(result.status).toBe('PENDING');
      expect(result.stepsTotal).toBe(3);
      expect(repository.createExecution).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'DAILY', stepsTotal: 3, createdBy: 'user-1' }),
      );
      expect(queue.add).toHaveBeenCalled();
    });

    it('should create execution for MANUAL using MONTHLY definition and return effectiveType', async () => {
      repository.checkRunningCycle.mockResolvedValue(null);
      repository.createExecution.mockResolvedValue({
        id: 'exec-2',
        createdAt: new Date(),
      } as any);

      const result = await service.triggerCycle('MANUAL', 'user-1');

      expect(result.type).toBe('MONTHLY');
      expect(result.stepsTotal).toBe(3);
      expect(repository.createExecution).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'MONTHLY', gatilho: 'MANUAL' }),
      );
    });

    it('should throw ConflictException when same type already running (AC-12)', async () => {
      repository.checkRunningCycle
        .mockResolvedValueOnce({ id: 'running-1' } as any)
        .mockResolvedValue(null);

      await expect(service.triggerCycle('DAILY')).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when higher-priority cycle running (AC-13)', async () => {
      repository.checkRunningCycle
        .mockResolvedValueOnce(null) // same type check
        .mockResolvedValueOnce({
          id: 'running-monthly',
          parametros: { cycleType: 'MONTHLY' },
        } as any); // any running check

      await expect(service.triggerCycle('DAILY')).rejects.toThrow(ConflictException);
    });

    it('should NOT block when lower-priority cycle is running', async () => {
      repository.checkRunningCycle
        .mockResolvedValueOnce(null) // same type check
        .mockResolvedValueOnce({
          id: 'running-daily',
          parametros: { cycleType: 'DAILY' },
        } as any); // any running check (daily has lower priority than monthly)
      repository.createExecution.mockResolvedValue({
        id: 'exec-3',
        createdAt: new Date(),
      } as any);

      const result = await service.triggerCycle('MONTHLY');

      expect(result.id).toBe('exec-3');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Execute Cycle
  // ────────────────────────────────────────────────────────────────

  describe('executeCycle', () => {
    it('should execute all steps and mark CONCLUIDO', async () => {
      repository.updateExecution.mockResolvedValue({} as any);
      repository.createStepLog.mockResolvedValue({ id: BigInt(1) } as any);
      repository.updateStepLog.mockResolvedValue({} as any);

      await service.executeCycle('exec-1', 'DAILY');

      expect(repository.updateExecution).toHaveBeenCalledWith(
        'exec-1', 'EXECUTANDO', expect.any(Object),
      );
      expect(repository.createStepLog).toHaveBeenCalledTimes(3);
      expect(repository.updateStepLog).toHaveBeenCalledTimes(3);

      const lastUpdate = repository.updateExecution.mock.calls.at(-1);
      expect(lastUpdate?.[1]).toBe('CONCLUIDO');
    });

    it('should mark PARCIAL if some steps succeed before failure', async () => {
      let callCount = 0;
      repository.updateExecution.mockResolvedValue({} as any);
      repository.createStepLog.mockImplementation(async () => {
        callCount++;
        return { id: BigInt(callCount) } as any;
      });
      repository.updateStepLog.mockResolvedValue({} as any);

      // Override executeStep to fail on step 2
      const originalExecute = (service as any).executeStep.bind(service);
      jest.spyOn(service as any, 'executeStep').mockImplementation(
        async (stepName: string) => {
          if (stepName === 'RECALCULATE_MRP') throw new Error('MRP failed');
        },
      );

      await service.executeCycle('exec-1', 'DAILY');

      const lastUpdate = repository.updateExecution.mock.calls.at(-1);
      expect(lastUpdate?.[1]).toBe('PARCIAL');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Query (AC-9, AC-11)
  // ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should delegate to repository', async () => {
      const mockResult = { data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 0, hasNext: false, hasPrev: false } };
      repository.findAll.mockResolvedValue(mockResult);

      const result = await service.findAll({ page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'desc' });

      expect(result).toEqual(mockResult);
    });
  });

  describe('findById', () => {
    it('should return execution detail', async () => {
      const mockDetail = {
        id: 'exec-1',
        type: 'DAILY' as const,
        status: 'SUCCESS' as const,
        steps: [],
        stepsCompleted: 3,
        stepsTotal: 3,
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
  // Schedule Info (AC-14)
  // ────────────────────────────────────────────────────────────────

  describe('getScheduleInfo', () => {
    it('should return schedule info for all cycle types', async () => {
      prisma.configSistema.findUnique.mockResolvedValue(null);
      repository.getLastExecution.mockResolvedValue(null);

      const result = await service.getScheduleInfo();

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('DAILY');
      expect(result[1].type).toBe('WEEKLY');
      expect(result[2].type).toBe('MONTHLY');
      expect(result[0].cronExpression).toBe('0 6 * * *');
    });

    it('should include last execution info when available', async () => {
      prisma.configSistema.findUnique.mockResolvedValue(null);
      repository.getLastExecution
        .mockResolvedValueOnce({
          id: 'last-daily',
          status: 'CONCLUIDO',
          startedAt: new Date('2026-02-28T06:00:00Z'),
          completedAt: new Date('2026-02-28T06:02:00Z'),
        })
        .mockResolvedValue(null);

      const result = await service.getScheduleInfo();

      expect(result[0].lastExecution).not.toBeNull();
      expect(result[0].lastExecution?.status).toBe('SUCCESS');
      expect(result[0].lastExecution?.durationMs).toBe(120000);
    });
  });
});
