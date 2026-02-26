import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MrpController } from './mrp.controller';
import { MrpService } from './mrp.service';
import { ExecuteMrpDto } from './dto/execute-mrp.dto';
import { FilterExecutionsDto } from './dto/filter-executions.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { FilterCapacityDto } from './dto/filter-capacity.dto';
import { FilterStockParamsDto } from './dto/filter-stock-params.dto';

describe('MrpController', () => {
  let controller: MrpController;
  let service: jest.Mocked<MrpService>;

  const mockExecucaoId = '123e4567-e89b-12d3-a456-426614174000';

  const mockExecutionResult = {
    execucaoId: mockExecucaoId,
    status: 'CONCLUIDO',
    message: 'MRP execution completed successfully',
    resultadoResumo: {
      totalProductsProcessed: 5,
      totalDemandPlanned: 1000,
      totalStockParamsCalculated: 10,
      totalNetRequirementsProcessed: 15,
      totalLotSizedProducts: 12,
      totalOrdersGenerated: 20,
      totalCompraOrders: 12,
      totalProducaoOrders: 8,
      totalActionMessages: 5,
      totalOverloadedWeeks: 2,
      totalStorageAlerts: 1,
      totalStorageCriticals: 0,
      stepDurations: {},
    },
  };

  const mockPaginatedExecutions = {
    data: [
      {
        id: mockExecucaoId,
        tipo: 'MRP',
        status: 'CONCLUIDO',
        gatilho: 'MANUAL',
        createdAt: new Date('2026-02-26'),
      },
    ],
    meta: {
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };

  const mockExecutionWithSteps = {
    id: mockExecucaoId,
    tipo: 'MRP',
    status: 'CONCLUIDO',
    gatilho: 'MANUAL',
    createdAt: new Date('2026-02-26'),
    stepLogs: [
      {
        id: BigInt(1),
        execucaoId: mockExecucaoId,
        stepName: 'MPS_GENERATION',
        stepOrder: 1,
        status: 'COMPLETED',
        recordsProcessed: BigInt(5),
        durationMs: 120,
        startedAt: new Date('2026-02-26'),
        completedAt: new Date('2026-02-26'),
      },
    ],
  };

  const mockPaginatedOrders = {
    data: [
      {
        id: 'order-1',
        execucaoId: mockExecucaoId,
        produtoId: 'prod-1',
        tipo: 'COMPRA',
        prioridade: 'MEDIA',
      },
    ],
    meta: {
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };

  const mockPaginatedCapacity = {
    data: [
      {
        id: BigInt(1),
        execucaoId: mockExecucaoId,
        centroTrabalhoId: 'wc-1',
        utilizacaoPercentual: 85.5,
      },
    ],
    meta: {
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };

  const mockPaginatedStockParams = {
    data: [
      {
        id: BigInt(1),
        execucaoId: mockExecucaoId,
        produtoId: 'prod-1',
        safetyStock: 50,
        reorderPoint: 100,
      },
    ],
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
      controllers: [MrpController],
      providers: [
        {
          provide: MrpService,
          useValue: {
            executeMrp: jest.fn(),
            findAllExecutions: jest.fn(),
            findExecutionById: jest.fn(),
            findOrders: jest.fn(),
            findCapacity: jest.fn(),
            findStockParams: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MrpController>(MrpController);
    service = module.get(MrpService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ────────────────────────────────────────────────────────────────
  // POST /mrp/execute
  // ────────────────────────────────────────────────────────────────

  describe('execute', () => {
    it('should trigger an MRP execution and return 202', async () => {
      const dto: ExecuteMrpDto = {};
      service.executeMrp.mockResolvedValue(mockExecutionResult as never);

      const result = await controller.execute(dto);

      expect(result).toEqual(mockExecutionResult);
      expect(service.executeMrp).toHaveBeenCalledWith(dto);
    });

    it('should pass planning parameters to the service', async () => {
      const dto: ExecuteMrpDto = {
        planningHorizonWeeks: 26,
        firmOrderHorizonWeeks: 4,
        forceRecalculate: true,
      };
      service.executeMrp.mockResolvedValue(mockExecutionResult as never);

      await controller.execute(dto);

      expect(service.executeMrp).toHaveBeenCalledWith(dto);
    });

    it('should return error status when execution fails', async () => {
      const dto: ExecuteMrpDto = {};
      const errorResult = {
        execucaoId: mockExecucaoId,
        status: 'ERRO',
        message: 'MRP execution failed: Stock params error',
      };
      service.executeMrp.mockResolvedValue(errorResult as never);

      const result = await controller.execute(dto);

      expect(result.status).toBe('ERRO');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // GET /mrp/executions
  // ────────────────────────────────────────────────────────────────

  describe('findAllExecutions', () => {
    it('should return paginated executions', async () => {
      const filters = new FilterExecutionsDto();
      service.findAllExecutions.mockResolvedValue(
        mockPaginatedExecutions as never,
      );

      const result = await controller.findAllExecutions(filters);

      expect(result).toEqual(mockPaginatedExecutions);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should pass status filter to service', async () => {
      const filters = new FilterExecutionsDto();
      filters.status = 'CONCLUIDO' as never;
      service.findAllExecutions.mockResolvedValue({
        ...mockPaginatedExecutions,
        data: [],
      } as never);

      await controller.findAllExecutions(filters);

      expect(service.findAllExecutions).toHaveBeenCalledWith(filters);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // GET /mrp/executions/:id
  // ────────────────────────────────────────────────────────────────

  describe('findExecutionById', () => {
    it('should return execution with step logs', async () => {
      service.findExecutionById.mockResolvedValue(
        mockExecutionWithSteps as never,
      );

      const result = await controller.findExecutionById(mockExecucaoId);

      expect(result).toEqual(mockExecutionWithSteps);
      expect(result.stepLogs).toHaveLength(1);
      expect(result.stepLogs[0].stepName).toBe('MPS_GENERATION');
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

  // ────────────────────────────────────────────────────────────────
  // GET /mrp/orders
  // ────────────────────────────────────────────────────────────────

  describe('findOrders', () => {
    it('should return paginated orders', async () => {
      const filters = new FilterOrdersDto();
      service.findOrders.mockResolvedValue(mockPaginatedOrders as never);

      const result = await controller.findOrders(filters);

      expect(result).toEqual(mockPaginatedOrders);
      expect(result.data).toHaveLength(1);
    });

    it('should pass order filters to service', async () => {
      const filters = new FilterOrdersDto();
      filters.execucaoId = mockExecucaoId;
      filters.tipo = 'COMPRA' as never;
      service.findOrders.mockResolvedValue(mockPaginatedOrders as never);

      await controller.findOrders(filters);

      expect(service.findOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          execucaoId: mockExecucaoId,
          tipo: 'COMPRA',
        }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // GET /mrp/capacity
  // ────────────────────────────────────────────────────────────────

  describe('findCapacity', () => {
    it('should return paginated capacity records', async () => {
      const filters = new FilterCapacityDto();
      service.findCapacity.mockResolvedValue(mockPaginatedCapacity as never);

      const result = await controller.findCapacity(filters);

      expect(result).toEqual(mockPaginatedCapacity);
      expect(result.data).toHaveLength(1);
    });

    it('should pass capacity filters to service', async () => {
      const filters = new FilterCapacityDto();
      filters.execucaoId = mockExecucaoId;
      filters.centroTrabalhoId = 'wc-1';
      service.findCapacity.mockResolvedValue(mockPaginatedCapacity as never);

      await controller.findCapacity(filters);

      expect(service.findCapacity).toHaveBeenCalledWith(
        expect.objectContaining({
          execucaoId: mockExecucaoId,
          centroTrabalhoId: 'wc-1',
        }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // GET /mrp/stock-params
  // ────────────────────────────────────────────────────────────────

  describe('findStockParams', () => {
    it('should return paginated stock params', async () => {
      const filters = new FilterStockParamsDto();
      service.findStockParams.mockResolvedValue(
        mockPaginatedStockParams as never,
      );

      const result = await controller.findStockParams(filters);

      expect(result).toEqual(mockPaginatedStockParams);
      expect(result.data).toHaveLength(1);
    });

    it('should pass stock params filters to service', async () => {
      const filters = new FilterStockParamsDto();
      filters.execucaoId = mockExecucaoId;
      filters.produtoId = 'prod-1';
      service.findStockParams.mockResolvedValue(
        mockPaginatedStockParams as never,
      );

      await controller.findStockParams(filters);

      expect(service.findStockParams).toHaveBeenCalledWith(
        expect.objectContaining({
          execucaoId: mockExecucaoId,
          produtoId: 'prod-1',
        }),
      );
    });
  });
});
