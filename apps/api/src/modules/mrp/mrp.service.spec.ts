import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { MrpService } from './mrp.service';
import { MrpRepository } from './mrp.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { MpsService } from './engine/mps.service';
import { StockParamsService } from './engine/stock-params.service';
import { BomExplosionService } from './engine/bom-explosion.service';
import { NetRequirementService } from './engine/net-requirement.service';
import { LotSizingService } from './engine/lot-sizing.service';
import { OrderGenerationService } from './engine/order-generation.service';
import { ActionMessagesService } from './engine/action-messages.service';
import { CrpService } from './engine/crp.service';
import { StorageValidationService } from './engine/storage-validation.service';
import { MrpInventoryHelper } from './engine/mrp-inventory.helper';
import { MrpScheduledReceiptsHelper } from './engine/mrp-scheduled-receipts.helper';
import { ExecuteMrpDto } from './dto/execute-mrp.dto';
import { FilterExecutionsDto } from './dto/filter-executions.dto';

describe('MrpService', () => {
  let service: MrpService;
  let repository: jest.Mocked<MrpRepository>;
  let prisma: Record<string, unknown>;
  let mpsService: jest.Mocked<MpsService>;
  let stockParamsService: jest.Mocked<StockParamsService>;
  let bomExplosionService: jest.Mocked<BomExplosionService>;
  let netRequirementService: jest.Mocked<NetRequirementService>;
  let lotSizingService: jest.Mocked<LotSizingService>;
  let orderGenerationService: jest.Mocked<OrderGenerationService>;
  let actionMessagesService: jest.Mocked<ActionMessagesService>;
  let crpService: jest.Mocked<CrpService>;
  let storageValidationService: jest.Mocked<StorageValidationService>;
  let inventoryHelper: jest.Mocked<MrpInventoryHelper>;
  let scheduledReceiptsHelper: jest.Mocked<MrpScheduledReceiptsHelper>;

  const mockExecucaoId = '123e4567-e89b-12d3-a456-426614174000';
  const mockNow = new Date('2026-02-26T10:00:00.000Z');

  const mockWeekStart = new Date('2026-02-23T00:00:00.000Z'); // Monday
  const mockWeekEnd = new Date('2026-03-01T23:59:59.999Z'); // Sunday

  const mockMpsOutput = {
    generatedAt: mockNow,
    planningHorizonWeeks: 13,
    firmOrderHorizonWeeks: 2,
    products: new Map([
      [
        'prod-acabado-1',
        {
          produtoId: 'prod-acabado-1',
          codigo: 'PA001',
          descricao: 'Finished Product 1',
          demandBuckets: [
            {
              periodStart: mockWeekStart,
              periodEnd: mockWeekEnd,
              forecastDemand: 100,
              firmOrderDemand: 80,
              mpsDemand: 100,
            },
          ],
          warnings: [],
        },
      ],
    ]),
    totalProductsProcessed: 1,
    totalDemandPlanned: 100,
  };

  const mockBomResult = {
    lowLevelCodes: { 'prod-acabado-1': 0, 'prod-mp-1': 1 },
    grossRequirements: new Map([
      [
        'prod-acabado-1',
        [{ periodStart: mockWeekStart, periodEnd: mockWeekEnd, quantity: 100 }],
      ],
      [
        'prod-mp-1',
        [{ periodStart: mockWeekStart, periodEnd: mockWeekEnd, quantity: 200 }],
      ],
    ]),
  };

  const mockNetRequirementRow = {
    produtoId: 'prod-acabado-1',
    periods: [
      {
        periodStart: mockWeekStart,
        periodEnd: mockWeekEnd,
        grossRequirement: 100,
        scheduledReceipts: 0,
        projectedStock: -50,
        netRequirement: 50,
        plannedOrderReceipts: 0,
      },
    ],
  };

  const mockLotSizingOutput = {
    produtoId: 'prod-acabado-1',
    plannedOrderReceipts: [
      {
        periodIndex: 0,
        periodStart: mockWeekStart,
        periodEnd: mockWeekEnd,
        quantity: 50,
      },
    ],
    plannedOrderReleases: [],
    pastDueReleases: [],
  };

  const mockOrderGenOutput = {
    execucaoId: mockExecucaoId,
    orders: [
      {
        produtoId: 'prod-acabado-1',
        tipo: 'PRODUCAO' as const,
        quantidade: 50,
        dataNecessidade: mockWeekStart,
        dataLiberacao: new Date('2026-02-16'),
        dataRecebimentoEsperado: mockWeekStart,
        fornecedorId: null,
        centroTrabalhoId: 'wc-1',
        custoEstimado: 500,
        lotificacaoUsada: 'L4L',
        prioridade: 'MEDIA' as const,
        status: 'PLANEJADA' as const,
        warnings: [],
      },
    ],
    totalCompraOrders: 0,
    totalProducaoOrders: 1,
    totalCustoEstimado: 500,
    warnings: [],
  };

  const mockActionMessagesOutput = {
    execucaoId: mockExecucaoId,
    messages: [
      {
        type: 'NEW' as const,
        produtoId: 'prod-acabado-1',
        existingOrderId: null,
        plannedOrderId: 'order-1',
        message: 'NEW: 50 units needed',
        deltaQuantity: null,
        deltaDays: null,
        currentDate: null,
        requiredDate: mockWeekStart,
      },
    ],
    totalCancel: 0,
    totalIncrease: 0,
    totalReduce: 0,
    totalExpedite: 0,
    totalNew: 1,
  };

  const mockCrpOutput = {
    execucaoId: mockExecucaoId,
    workCenters: [
      {
        centroTrabalhoId: 'wc-1',
        codigo: 'WC001',
        nome: 'Work Center 1',
        weeklyCapacity: [],
      },
    ],
    totalOverloadedWeeks: 0,
    warnings: [],
  };

  const mockStorageOutput = {
    depositos: [],
    totalAlerts: 0,
    totalCriticals: 0,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      produto: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      bom: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      parametrosEstoque: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      produtoFornecedor: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      ordemPlanejada: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MrpService,
        {
          provide: MrpRepository,
          useValue: {
            createExecution: jest.fn().mockResolvedValue({ id: mockExecucaoId }),
            updateExecutionStatus: jest.fn().mockResolvedValue({}),
            checkRunningExecution: jest.fn().mockResolvedValue(null),
            createStepLog: jest.fn().mockResolvedValue({ id: BigInt(1), startedAt: mockNow }),
            updateStepLog: jest.fn().mockResolvedValue({}),
            findExecutions: jest.fn(),
            findExecutionById: jest.fn(),
            findOrders: jest.fn(),
            findCapacity: jest.fn(),
            findStockParams: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: MpsService,
          useValue: {
            generateMps: jest.fn().mockResolvedValue(mockMpsOutput),
            getStartOfWeek: jest.fn().mockReturnValue(mockWeekStart),
            generateWeeklyBuckets: jest.fn().mockReturnValue([
              { periodStart: mockWeekStart, periodEnd: mockWeekEnd },
            ]),
          },
        },
        {
          provide: StockParamsService,
          useValue: {
            calculateForProduct: jest.fn().mockResolvedValue({
              id: 'sp-1',
              execucaoId: mockExecucaoId,
              produtoId: 'prod-acabado-1',
              safetyStock: 10,
              reorderPoint: 50,
              estoqueMinimo: 50,
              estoqueMaximo: 200,
              eoq: 100,
              metodoCalculo: 'FORMULA_CLASSICA',
              nivelServicoUsado: 0.95,
              calculatedAt: mockNow,
            }),
          },
        },
        {
          provide: BomExplosionService,
          useValue: {
            explode: jest.fn().mockReturnValue(mockBomResult),
          },
        },
        {
          provide: NetRequirementService,
          useValue: {
            calculateNetRequirements: jest.fn().mockReturnValue(mockNetRequirementRow),
          },
        },
        {
          provide: LotSizingService,
          useValue: {
            calculateLotSizing: jest.fn().mockReturnValue(mockLotSizingOutput),
          },
        },
        {
          provide: OrderGenerationService,
          useValue: {
            generateOrders: jest.fn().mockResolvedValue(mockOrderGenOutput),
          },
        },
        {
          provide: ActionMessagesService,
          useValue: {
            generateActionMessages: jest.fn().mockResolvedValue(mockActionMessagesOutput),
          },
        },
        {
          provide: CrpService,
          useValue: {
            calculateCrp: jest.fn().mockResolvedValue(mockCrpOutput),
          },
        },
        {
          provide: StorageValidationService,
          useValue: {
            validateStorage: jest.fn().mockResolvedValue(mockStorageOutput),
          },
        },
        {
          provide: MrpInventoryHelper,
          useValue: {
            getAvailableStockBatch: jest.fn().mockResolvedValue(new Map([
              ['prod-acabado-1', 50],
              ['prod-mp-1', 100],
            ])),
          },
        },
        {
          provide: MrpScheduledReceiptsHelper,
          useValue: {
            getScheduledReceiptsBatch: jest.fn().mockResolvedValue(new Map([
              ['prod-acabado-1', new Map([[0, 0]])],
              ['prod-mp-1', new Map([[0, 0]])],
            ])),
          },
        },
      ],
    }).compile();

    service = module.get<MrpService>(MrpService);
    repository = module.get(MrpRepository);
    prisma = module.get(PrismaService);
    mpsService = module.get(MpsService);
    stockParamsService = module.get(StockParamsService);
    bomExplosionService = module.get(BomExplosionService);
    netRequirementService = module.get(NetRequirementService);
    lotSizingService = module.get(LotSizingService);
    orderGenerationService = module.get(OrderGenerationService);
    actionMessagesService = module.get(ActionMessagesService);
    crpService = module.get(CrpService);
    storageValidationService = module.get(StorageValidationService);
    inventoryHelper = module.get(MrpInventoryHelper);
    scheduledReceiptsHelper = module.get(MrpScheduledReceiptsHelper);

    // Set up product data for lot sizing
    (prisma as Record<string, unknown>).produto = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'prod-acabado-1',
          tipoProduto: 'ACABADO',
          ativo: true,
          lotificacao: 'L4L',
          loteMinimo: 1,
          multiploCompra: 1,
          leadTimeProducaoDias: 7,
          custoUnitario: 10,
          custoPedido: 50,
          custoManutencaoPctAno: 25,
        },
      ]),
      findUnique: jest.fn().mockResolvedValue({ lotificacao: 'L4L' }),
    };

    (prisma as Record<string, unknown>).bom = {
      findMany: jest.fn().mockResolvedValue([]),
    };

    (prisma as Record<string, unknown>).parametrosEstoque = {
      findMany: jest.fn().mockResolvedValue([
        { produtoId: 'prod-acabado-1', safetyStock: 10, eoq: 100 },
      ]),
    };

    (prisma as Record<string, unknown>).produtoFornecedor = {
      findMany: jest.fn().mockResolvedValue([]),
    };

    (prisma as Record<string, unknown>).ordemPlanejada = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'order-1',
          produtoId: 'prod-acabado-1',
          tipo: 'PRODUCAO',
          quantidade: 50,
          dataNecessidade: mockWeekStart,
        },
      ]),
    };
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ────────────────────────────────────────────────────────────────
  // Full MRP Run
  // ────────────────────────────────────────────────────────────────

  describe('executeMrp', () => {
    it('should execute all 8 steps in order and return CONCLUIDO', async () => {
      const dto: ExecuteMrpDto = { forceRecalculate: true };
      const result = await service.executeMrp(dto);

      expect(result.execucaoId).toBe(mockExecucaoId);
      expect(result.status).toBe('CONCLUIDO');
      expect(result.message).toContain('completed successfully');

      // Verify execution was created
      expect(repository.createExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'MRP',
          status: 'PENDENTE',
          gatilho: 'MANUAL',
        }),
      );

      // Verify status updated to EXECUTANDO
      expect(repository.updateExecutionStatus).toHaveBeenCalledWith(
        mockExecucaoId,
        'EXECUTANDO',
        expect.objectContaining({ startedAt: expect.any(Date) }),
      );

      // Verify all 8 steps were logged
      expect(repository.createStepLog).toHaveBeenCalledTimes(8);

      // Verify step 1: MPS
      expect(mpsService.generateMps).toHaveBeenCalled();

      // Verify step 2: Stock Params
      expect(stockParamsService.calculateForProduct).toHaveBeenCalled();

      // Verify step 3: BOM Explosion + Netting
      expect(bomExplosionService.explode).toHaveBeenCalled();
      expect(netRequirementService.calculateNetRequirements).toHaveBeenCalled();

      // Verify step 4: Lot Sizing
      expect(lotSizingService.calculateLotSizing).toHaveBeenCalled();

      // Verify step 5: Order Generation
      expect(orderGenerationService.generateOrders).toHaveBeenCalled();

      // Verify step 6: Action Messages
      expect(actionMessagesService.generateActionMessages).toHaveBeenCalled();

      // Verify step 7: CRP
      expect(crpService.calculateCrp).toHaveBeenCalled();

      // Verify step 8: Storage Validation
      expect(storageValidationService.validateStorage).toHaveBeenCalled();

      // Verify final status set to CONCLUIDO
      expect(repository.updateExecutionStatus).toHaveBeenCalledWith(
        mockExecucaoId,
        'CONCLUIDO',
        expect.objectContaining({
          completedAt: expect.any(Date),
          resultadoResumo: expect.any(Object),
        }),
      );
    });

    it('should honor optional parameters', async () => {
      const dto: ExecuteMrpDto = {
        planningHorizonWeeks: 26,
        firmOrderHorizonWeeks: 4,
        forceRecalculate: true,
      };

      await service.executeMrp(dto);

      expect(mpsService.generateMps).toHaveBeenCalledWith({
        planningHorizonWeeks: 26,
        firmOrderHorizonWeeks: 4,
      });
    });

    it('should include result summary in output', async () => {
      const result = await service.executeMrp({});

      expect(result.resultadoResumo).toBeDefined();
      expect(result.resultadoResumo!.totalProductsProcessed).toBe(1);
      expect(result.resultadoResumo!.totalDemandPlanned).toBe(100);
      expect(result.resultadoResumo!.totalOrdersGenerated).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Concurrency Guard
  // ────────────────────────────────────────────────────────────────

  describe('concurrency guard', () => {
    it('should reject if another execution is EXECUTANDO', async () => {
      repository.checkRunningExecution.mockResolvedValue({
        id: 'other-execution',
        status: 'EXECUTANDO',
      } as never);

      await expect(service.executeMrp({})).rejects.toThrow(ConflictException);
      expect(repository.createExecution).not.toHaveBeenCalled();
    });

    it('should proceed when no execution is running', async () => {
      repository.checkRunningExecution.mockResolvedValue(null);

      const result = await service.executeMrp({});

      expect(result.status).toBe('CONCLUIDO');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Step Failure
  // ────────────────────────────────────────────────────────────────

  describe('step failure handling', () => {
    it('should set status to ERRO when step 3 fails', async () => {
      bomExplosionService.explode.mockImplementation(() => {
        throw new Error('Circular BOM reference detected');
      });

      const result = await service.executeMrp({});

      expect(result.status).toBe('ERRO');
      expect(result.message).toContain('Circular BOM reference detected');

      // Verify steps 4-8 were NOT called
      expect(lotSizingService.calculateLotSizing).not.toHaveBeenCalled();
      expect(orderGenerationService.generateOrders).not.toHaveBeenCalled();
      expect(actionMessagesService.generateActionMessages).not.toHaveBeenCalled();
      expect(crpService.calculateCrp).not.toHaveBeenCalled();
      expect(storageValidationService.validateStorage).not.toHaveBeenCalled();

      // Verify execution status set to ERRO
      expect(repository.updateExecutionStatus).toHaveBeenCalledWith(
        mockExecucaoId,
        'ERRO',
        expect.objectContaining({
          errorMessage: expect.stringContaining('Circular BOM reference detected'),
        }),
      );
    });

    it('should set status to ERRO when step 1 fails', async () => {
      mpsService.generateMps.mockRejectedValue(new Error('MPS generation failed'));

      const result = await service.executeMrp({});

      expect(result.status).toBe('ERRO');
      expect(result.message).toContain('MPS generation failed');

      // Verify no subsequent steps were called
      expect(stockParamsService.calculateForProduct).not.toHaveBeenCalled();
      expect(bomExplosionService.explode).not.toHaveBeenCalled();
    });

    it('should set status to ERRO when step 5 fails', async () => {
      orderGenerationService.generateOrders.mockRejectedValue(
        new Error('Database write failure'),
      );

      const result = await service.executeMrp({});

      expect(result.status).toBe('ERRO');

      // Steps 1-4 were called, steps 6-8 were NOT
      expect(mpsService.generateMps).toHaveBeenCalled();
      expect(actionMessagesService.generateActionMessages).not.toHaveBeenCalled();
    });

    it('should log step failure in step log', async () => {
      mpsService.generateMps.mockRejectedValue(new Error('MPS error'));

      await service.executeMrp({});

      // Step log should be updated with FAILED status
      expect(repository.updateStepLog).toHaveBeenCalledWith(
        BigInt(1),
        expect.objectContaining({
          status: 'FAILED',
          details: expect.objectContaining({ error: 'MPS error' }),
        }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Read Endpoints
  // ────────────────────────────────────────────────────────────────

  describe('findAllExecutions', () => {
    it('should delegate to repository', async () => {
      const mockResult = {
        data: [],
        meta: { total: 0, page: 1, limit: 50, totalPages: 0, hasNext: false, hasPrev: false },
      };
      repository.findExecutions.mockResolvedValue(mockResult as never);

      const filters = new FilterExecutionsDto();
      const result = await service.findAllExecutions(filters);

      expect(result).toEqual(mockResult);
      expect(repository.findExecutions).toHaveBeenCalledWith(filters);
    });
  });

  describe('findExecutionById', () => {
    it('should return execution when found', async () => {
      const mockExecution = { id: mockExecucaoId, tipo: 'MRP', stepLogs: [] };
      repository.findExecutionById.mockResolvedValue(mockExecution as never);

      const result = await service.findExecutionById(mockExecucaoId);

      expect(result).toEqual(mockExecution);
    });

    it('should throw NotFoundException when not found', async () => {
      repository.findExecutionById.mockResolvedValue(null);

      await expect(
        service.findExecutionById('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOrders', () => {
    it('should delegate to repository', async () => {
      const mockResult = {
        data: [],
        meta: { total: 0, page: 1, limit: 50, totalPages: 0, hasNext: false, hasPrev: false },
      };
      repository.findOrders.mockResolvedValue(mockResult as never);

      const result = await service.findOrders({} as never);

      expect(result).toEqual(mockResult);
    });
  });

  describe('findCapacity', () => {
    it('should delegate to repository', async () => {
      const mockResult = {
        data: [],
        meta: { total: 0, page: 1, limit: 50, totalPages: 0, hasNext: false, hasPrev: false },
      };
      repository.findCapacity.mockResolvedValue(mockResult as never);

      const result = await service.findCapacity({} as never);

      expect(result).toEqual(mockResult);
    });
  });

  describe('findStockParams', () => {
    it('should delegate to repository', async () => {
      const mockResult = {
        data: [],
        meta: { total: 0, page: 1, limit: 50, totalPages: 0, hasNext: false, hasPrev: false },
      };
      repository.findStockParams.mockResolvedValue(mockResult as never);

      const result = await service.findStockParams({} as never);

      expect(result).toEqual(mockResult);
    });
  });
});
