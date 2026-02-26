import { Test, TestingModule } from '@nestjs/testing';

import { CycleController } from './cycle.controller';
import { CycleService } from './cycle.service';
import type { CycleExecution } from './cycle.types';

describe('CycleController', () => {
  let controller: CycleController;
  let service: jest.Mocked<CycleService>;

  const mockExecution: CycleExecution = {
    id: 'exec-1',
    type: 'DAILY',
    status: 'PENDING',
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    stepsCompleted: 0,
    stepsTotal: 3,
    resultSummary: null,
    createdAt: new Date('2026-02-28T06:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CycleController],
      providers: [
        {
          provide: CycleService,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            triggerCycle: jest.fn(),
            getScheduleInfo: jest.fn(),
            getScheduleConfig: jest.fn(),
            saveScheduleConfig: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CycleController>(CycleController);
    service = module.get(CycleService);
  });

  describe('findAll', () => {
    it('should return paginated cycle executions', async () => {
      const result = {
        data: [mockExecution],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1, hasNext: false, hasPrev: false },
      };
      service.findAll.mockResolvedValue(result);

      const response = await controller.findAll({ page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'desc' });

      expect(response.data).toHaveLength(1);
      expect(response.meta.total).toBe(1);
    });
  });

  describe('triggerCycle', () => {
    it('should trigger cycle with user ID from JWT', async () => {
      service.triggerCycle.mockResolvedValue(mockExecution);
      const mockReq = { user: { sub: 'user-1' } } as any;

      const result = await controller.triggerCycle({ type: 'DAILY' }, mockReq);

      expect(result).toEqual(mockExecution);
      expect(service.triggerCycle).toHaveBeenCalledWith('DAILY', 'user-1');
    });

    it('should fallback to unknown when no JWT user', async () => {
      service.triggerCycle.mockResolvedValue(mockExecution);
      const mockReq = {} as any;

      await controller.triggerCycle({ type: 'MONTHLY' }, mockReq);

      expect(service.triggerCycle).toHaveBeenCalledWith('MONTHLY', 'unknown');
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

  describe('getScheduleInfo', () => {
    it('should return schedule info array', async () => {
      const schedules = [
        { type: 'DAILY', label: 'Ciclo Diario', cronExpression: '0 6 * * *', nextRunAt: null, lastExecution: null },
      ];
      service.getScheduleInfo.mockResolvedValue(schedules as any);

      const result = await controller.getScheduleInfo();

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('DAILY');
    });
  });

  describe('getScheduleConfig', () => {
    it('should return cron configuration', async () => {
      service.getScheduleConfig.mockResolvedValue({
        daily: '0 6 * * *',
        weekly: '0 3 * * 1',
        monthly: '0 2 1 * *',
      });

      const result = await controller.getScheduleConfig();

      expect(result.daily).toBe('0 6 * * *');
    });
  });

  describe('saveScheduleConfig', () => {
    it('should save and return updated schedule config', async () => {
      const config = { daily: '0 7 * * *', weekly: '0 4 * * 2', monthly: '0 3 1 * *' };
      service.saveScheduleConfig.mockResolvedValue(config);

      const result = await controller.saveScheduleConfig(config as any);

      expect(result).toEqual(config);
      expect(service.saveScheduleConfig).toHaveBeenCalledWith(config);
    });
  });
});
