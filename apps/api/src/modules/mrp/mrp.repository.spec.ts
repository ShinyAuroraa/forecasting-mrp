import { Test, TestingModule } from '@nestjs/testing';
import { MrpRepository } from './mrp.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { FilterExecutionsDto } from './dto/filter-executions.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { FilterCapacityDto } from './dto/filter-capacity.dto';
import { FilterStockParamsDto } from './dto/filter-stock-params.dto';

describe('MrpRepository', () => {
  let repository: MrpRepository;
  let prisma: jest.Mocked<PrismaService>;

  const mockExecucaoId = '123e4567-e89b-12d3-a456-426614174000';
  const mockNow = new Date('2026-02-26T10:00:00.000Z');

  const mockExecution = {
    id: mockExecucaoId,
    tipo: 'MRP',
    status: 'PENDENTE',
    gatilho: 'MANUAL',
    parametros: null,
    resultadoResumo: null,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    createdBy: null,
    createdAt: mockNow,
  };

  const mockStepLog = {
    id: BigInt(1),
    execucaoId: mockExecucaoId,
    stepName: 'MPS_GENERATION',
    stepOrder: 1,
    status: 'RUNNING',
    recordsProcessed: null,
    durationMs: null,
    details: null,
    startedAt: mockNow,
    completedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MrpRepository,
        {
          provide: PrismaService,
          useValue: {
            execucaoPlanejamento: {
              create: jest.fn(),
              update: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
            },
            execucaoStepLog: {
              create: jest.fn(),
              update: jest.fn(),
            },
            ordemPlanejada: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
            cargaCapacidade: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
            parametrosEstoque: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    repository = module.get<MrpRepository>(MrpRepository);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  // ────────────────────────────────────────────────────────────────
  // Execution CRUD
  // ────────────────────────────────────────────────────────────────

  describe('createExecution', () => {
    it('should create an MRP execution record', async () => {
      (prisma.execucaoPlanejamento.create as jest.Mock).mockResolvedValue(mockExecution);

      const result = await repository.createExecution({
        tipo: 'MRP',
        status: 'PENDENTE',
        gatilho: 'MANUAL',
      });

      expect(result).toEqual(mockExecution);
      expect(prisma.execucaoPlanejamento.create).toHaveBeenCalledWith({
        data: {
          tipo: 'MRP',
          status: 'PENDENTE',
          gatilho: 'MANUAL',
          parametros: null,
          createdBy: null,
        },
      });
    });

    it('should include parametros when provided', async () => {
      (prisma.execucaoPlanejamento.create as jest.Mock).mockResolvedValue(mockExecution);

      await repository.createExecution({
        tipo: 'MRP',
        status: 'PENDENTE',
        gatilho: 'MANUAL',
        parametros: { planningHorizonWeeks: 26 },
      });

      expect(prisma.execucaoPlanejamento.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          parametros: { planningHorizonWeeks: 26 },
        }),
      });
    });
  });

  describe('updateExecutionStatus', () => {
    it('should update execution status', async () => {
      const updatedExecution = { ...mockExecution, status: 'EXECUTANDO' };
      (prisma.execucaoPlanejamento.update as jest.Mock).mockResolvedValue(updatedExecution);

      const result = await repository.updateExecutionStatus(
        mockExecucaoId,
        'EXECUTANDO',
        { startedAt: mockNow },
      );

      expect(result.status).toBe('EXECUTANDO');
      expect(prisma.execucaoPlanejamento.update).toHaveBeenCalledWith({
        where: { id: mockExecucaoId },
        data: expect.objectContaining({
          status: 'EXECUTANDO',
          startedAt: mockNow,
        }),
      });
    });

    it('should update with errorMessage on failure', async () => {
      const failedExecution = { ...mockExecution, status: 'ERRO', errorMessage: 'Test error' };
      (prisma.execucaoPlanejamento.update as jest.Mock).mockResolvedValue(failedExecution);

      const result = await repository.updateExecutionStatus(
        mockExecucaoId,
        'ERRO',
        { errorMessage: 'Test error', completedAt: mockNow },
      );

      expect(result.status).toBe('ERRO');
      expect(result.errorMessage).toBe('Test error');
    });

    it('should update with resultadoResumo on completion', async () => {
      const completedExecution = {
        ...mockExecution,
        status: 'CONCLUIDO',
        resultadoResumo: { totalOrders: 10 },
      };
      (prisma.execucaoPlanejamento.update as jest.Mock).mockResolvedValue(completedExecution);

      await repository.updateExecutionStatus(
        mockExecucaoId,
        'CONCLUIDO',
        { completedAt: mockNow, resultadoResumo: { totalOrders: 10 } },
      );

      expect(prisma.execucaoPlanejamento.update).toHaveBeenCalledWith({
        where: { id: mockExecucaoId },
        data: expect.objectContaining({
          status: 'CONCLUIDO',
          resultadoResumo: { totalOrders: 10 },
        }),
      });
    });
  });

  describe('checkRunningExecution', () => {
    it('should return null when no execution is running', async () => {
      (prisma.execucaoPlanejamento.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repository.checkRunningExecution();

      expect(result).toBeNull();
      expect(prisma.execucaoPlanejamento.findFirst).toHaveBeenCalledWith({
        where: { tipo: 'MRP', status: 'EXECUTANDO' },
      });
    });

    it('should return the running execution', async () => {
      const runningExecution = { ...mockExecution, status: 'EXECUTANDO' };
      (prisma.execucaoPlanejamento.findFirst as jest.Mock).mockResolvedValue(runningExecution);

      const result = await repository.checkRunningExecution();

      expect(result).toEqual(runningExecution);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Step Log CRUD
  // ────────────────────────────────────────────────────────────────

  describe('createStepLog', () => {
    it('should create a step log entry', async () => {
      (prisma.execucaoStepLog.create as jest.Mock).mockResolvedValue(mockStepLog);

      const result = await repository.createStepLog({
        execucaoId: mockExecucaoId,
        stepName: 'MPS_GENERATION',
        stepOrder: 1,
        status: 'RUNNING',
        startedAt: mockNow,
      });

      expect(result).toEqual(mockStepLog);
      expect(prisma.execucaoStepLog.create).toHaveBeenCalledWith({
        data: {
          execucaoId: mockExecucaoId,
          stepName: 'MPS_GENERATION',
          stepOrder: 1,
          status: 'RUNNING',
          startedAt: mockNow,
        },
      });
    });
  });

  describe('updateStepLog', () => {
    it('should update step log with completion data', async () => {
      const updatedStep = {
        ...mockStepLog,
        status: 'COMPLETED',
        recordsProcessed: BigInt(5),
        durationMs: 150,
      };
      (prisma.execucaoStepLog.update as jest.Mock).mockResolvedValue(updatedStep);

      const result = await repository.updateStepLog(BigInt(1), {
        status: 'COMPLETED',
        recordsProcessed: 5,
        durationMs: 150,
        completedAt: mockNow,
      });

      expect(result.status).toBe('COMPLETED');
      expect(prisma.execucaoStepLog.update).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        data: expect.objectContaining({
          status: 'COMPLETED',
          recordsProcessed: BigInt(5),
          durationMs: 150,
          completedAt: mockNow,
        }),
      });
    });

    it('should update step log with failure details', async () => {
      const failedStep = { ...mockStepLog, status: 'FAILED' };
      (prisma.execucaoStepLog.update as jest.Mock).mockResolvedValue(failedStep);

      await repository.updateStepLog(BigInt(1), {
        status: 'FAILED',
        durationMs: 50,
        completedAt: mockNow,
        details: { error: 'Step failed' },
      });

      expect(prisma.execucaoStepLog.update).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        data: expect.objectContaining({
          status: 'FAILED',
          details: { error: 'Step failed' },
        }),
      });
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Read Endpoints
  // ────────────────────────────────────────────────────────────────

  describe('findExecutions', () => {
    it('should return paginated executions with default filters', async () => {
      (prisma.execucaoPlanejamento.findMany as jest.Mock).mockResolvedValue([mockExecution]);
      (prisma.execucaoPlanejamento.count as jest.Mock).mockResolvedValue(1);

      const filters = new FilterExecutionsDto();
      const result = await repository.findExecutions(filters);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(50);
    });

    it('should apply status filter', async () => {
      (prisma.execucaoPlanejamento.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.execucaoPlanejamento.count as jest.Mock).mockResolvedValue(0);

      const filters = new FilterExecutionsDto();
      filters.status = 'CONCLUIDO' as never;
      await repository.findExecutions(filters);

      expect(prisma.execucaoPlanejamento.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tipo: 'MRP', status: 'CONCLUIDO' },
        }),
      );
    });

    it('should apply pagination parameters', async () => {
      (prisma.execucaoPlanejamento.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.execucaoPlanejamento.count as jest.Mock).mockResolvedValue(0);

      const filters = new FilterExecutionsDto();
      filters.page = 2;
      filters.limit = 10;
      await repository.findExecutions(filters);

      expect(prisma.execucaoPlanejamento.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });
  });

  describe('findExecutionById', () => {
    it('should return execution with step logs', async () => {
      const executionWithSteps = { ...mockExecution, stepLogs: [mockStepLog] };
      (prisma.execucaoPlanejamento.findUnique as jest.Mock).mockResolvedValue(executionWithSteps);

      const result = await repository.findExecutionById(mockExecucaoId);

      expect(result).toEqual(executionWithSteps);
      expect(prisma.execucaoPlanejamento.findUnique).toHaveBeenCalledWith({
        where: { id: mockExecucaoId },
        include: { stepLogs: { orderBy: { stepOrder: 'asc' } } },
      });
    });

    it('should return null for non-existent execution', async () => {
      (prisma.execucaoPlanejamento.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findExecutionById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findOrders', () => {
    it('should return paginated orders with default filters', async () => {
      const mockOrder = {
        id: 'order-1',
        execucaoId: mockExecucaoId,
        produtoId: 'prod-1',
        tipo: 'COMPRA',
      };
      (prisma.ordemPlanejada.findMany as jest.Mock).mockResolvedValue([mockOrder]);
      (prisma.ordemPlanejada.count as jest.Mock).mockResolvedValue(1);

      const filters = new FilterOrdersDto();
      const result = await repository.findOrders(filters);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should apply all order filters', async () => {
      (prisma.ordemPlanejada.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ordemPlanejada.count as jest.Mock).mockResolvedValue(0);

      const filters = new FilterOrdersDto();
      filters.execucaoId = mockExecucaoId;
      filters.tipo = 'COMPRA' as never;
      filters.prioridade = 'ALTA' as never;
      filters.produtoId = 'prod-1';
      await repository.findOrders(filters);

      expect(prisma.ordemPlanejada.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            execucaoId: mockExecucaoId,
            tipo: 'COMPRA',
            prioridade: 'ALTA',
            produtoId: 'prod-1',
          },
        }),
      );
    });
  });

  describe('findCapacity', () => {
    it('should return paginated capacity records', async () => {
      const mockCapacity = {
        id: BigInt(1),
        execucaoId: mockExecucaoId,
        centroTrabalhoId: 'wc-1',
      };
      (prisma.cargaCapacidade.findMany as jest.Mock).mockResolvedValue([mockCapacity]);
      (prisma.cargaCapacidade.count as jest.Mock).mockResolvedValue(1);

      const filters = new FilterCapacityDto();
      const result = await repository.findCapacity(filters);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should apply capacity filters', async () => {
      (prisma.cargaCapacidade.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.cargaCapacidade.count as jest.Mock).mockResolvedValue(0);

      const filters = new FilterCapacityDto();
      filters.execucaoId = mockExecucaoId;
      filters.centroTrabalhoId = 'wc-1';
      await repository.findCapacity(filters);

      expect(prisma.cargaCapacidade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            execucaoId: mockExecucaoId,
            centroTrabalhoId: 'wc-1',
          },
        }),
      );
    });
  });

  describe('findStockParams', () => {
    it('should return paginated stock params', async () => {
      const mockParam = {
        id: BigInt(1),
        execucaoId: mockExecucaoId,
        produtoId: 'prod-1',
      };
      (prisma.parametrosEstoque.findMany as jest.Mock).mockResolvedValue([mockParam]);
      (prisma.parametrosEstoque.count as jest.Mock).mockResolvedValue(1);

      const filters = new FilterStockParamsDto();
      const result = await repository.findStockParams(filters);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should apply stock params filters', async () => {
      (prisma.parametrosEstoque.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.parametrosEstoque.count as jest.Mock).mockResolvedValue(0);

      const filters = new FilterStockParamsDto();
      filters.execucaoId = mockExecucaoId;
      filters.produtoId = 'prod-1';
      await repository.findStockParams(filters);

      expect(prisma.parametrosEstoque.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            execucaoId: mockExecucaoId,
            produtoId: 'prod-1',
          },
        }),
      );
    });
  });
});
