import { Test, TestingModule } from '@nestjs/testing';
import { AlertDetectorService } from './alert-detector.service';
import { NotificacaoService } from '../notificacao.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('AlertDetectorService', () => {
  let detector: AlertDetectorService;
  let prisma: any;
  let notificacaoService: jest.Mocked<NotificacaoService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertDetectorService,
        {
          provide: PrismaService,
          useValue: {
            inventarioAtual: { findMany: jest.fn().mockResolvedValue([]) },
            ordemPlanejada: { findMany: jest.fn().mockResolvedValue([]) },
            eventoCapacidade: { findMany: jest.fn().mockResolvedValue([]) },
            resultadoForecast: { findMany: jest.fn().mockResolvedValue([]) },
            deposito: { findMany: jest.fn().mockResolvedValue([]) },
            notificacao: { count: jest.fn().mockResolvedValue(0) },
          },
        },
        {
          provide: NotificacaoService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'alert-1' }),
          },
        },
      ],
    }).compile();

    detector = module.get<AlertDetectorService>(AlertDetectorService);
    prisma = module.get(PrismaService);
    notificacaoService = module.get(NotificacaoService);
  });

  describe('detectStockout', () => {
    it('should create STOCKOUT alert when inventory is negative', async () => {
      prisma.inventarioAtual.findMany.mockResolvedValue([
        {
          quantidadeDisponivel: -10,
          produto: { id: 'prod-1', sku: 'SKU-001', descricao: 'Widget A' },
        },
      ]);

      await detector.detectStockout();

      expect(notificacaoService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'STOCKOUT',
          severidade: 'CRITICAL',
          entityId: 'prod-1',
        }),
      );
    });

    it('should skip if recent alert already exists', async () => {
      prisma.inventarioAtual.findMany.mockResolvedValue([
        {
          quantidadeDisponivel: -5,
          produto: { id: 'prod-1', sku: 'SKU-001', descricao: 'Widget A' },
        },
      ]);
      prisma.notificacao.count.mockResolvedValue(1);

      await detector.detectStockout();

      expect(notificacaoService.create).not.toHaveBeenCalled();
    });

    it('should not create alert when no negative inventory', async () => {
      prisma.inventarioAtual.findMany.mockResolvedValue([]);

      await detector.detectStockout();

      expect(notificacaoService.create).not.toHaveBeenCalled();
    });
  });

  describe('detectUrgentPurchase', () => {
    it('should create URGENT_PURCHASE alert for orders within 7 days', async () => {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      prisma.ordemPlanejada.findMany.mockResolvedValue([
        {
          id: 'order-1',
          tipo: 'COMPRA',
          dataLiberacao: threeDaysFromNow,
          quantidade: 500,
          produto: { id: 'prod-2', sku: 'SKU-002', descricao: 'Widget B' },
        },
      ]);

      await detector.detectUrgentPurchase();

      expect(notificacaoService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'URGENT_PURCHASE',
          severidade: 'HIGH',
          entityId: 'order-1',
        }),
      );
    });
  });

  describe('detectCapacityOverload', () => {
    it('should create CAPACITY_OVERLOAD alert when utilization > 110%', async () => {
      prisma.eventoCapacidade.findMany.mockResolvedValue([
        {
          utilizacaoPct: 125,
          periodoInicio: new Date(),
          centroTrabalho: { id: 'ct-1', nome: 'CNC Lathe', codigo: 'CT-001' },
        },
      ]);

      await detector.detectCapacityOverload();

      expect(notificacaoService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'CAPACITY_OVERLOAD',
          severidade: 'HIGH',
          entityId: 'ct-1',
        }),
      );
    });

    it('should set CRITICAL severity when utilization > 150%', async () => {
      prisma.eventoCapacidade.findMany.mockResolvedValue([
        {
          utilizacaoPct: 160,
          periodoInicio: new Date(),
          centroTrabalho: { id: 'ct-2', nome: 'Assembly', codigo: 'CT-002' },
        },
      ]);

      await detector.detectCapacityOverload();

      expect(notificacaoService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          severidade: 'CRITICAL',
        }),
      );
    });
  });

  describe('detectForecastDeviation', () => {
    it('should create FORECAST_DEVIATION alert when MAPE > threshold', async () => {
      prisma.resultadoForecast.findMany.mockResolvedValue([
        {
          mape: 45,
          produto: { id: 'prod-3', sku: 'SKU-003', descricao: 'Widget C' },
        },
      ]);

      await detector.detectForecastDeviation();

      expect(notificacaoService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'FORECAST_DEVIATION',
          severidade: 'MEDIUM',
        }),
      );
    });

    it('should use configurable threshold', async () => {
      detector.setForecastDeviationThreshold(20);

      prisma.resultadoForecast.findMany.mockResolvedValue([
        {
          mape: 25,
          produto: { id: 'prod-4', sku: 'SKU-004', descricao: 'Widget D' },
        },
      ]);

      await detector.detectForecastDeviation();

      expect(notificacaoService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'FORECAST_DEVIATION',
        }),
      );
    });

    it('should reject invalid threshold values', () => {
      expect(() => detector.setForecastDeviationThreshold(0)).toThrow('Invalid threshold');
      expect(() => detector.setForecastDeviationThreshold(-5)).toThrow('Invalid threshold');
      expect(() => detector.setForecastDeviationThreshold(101)).toThrow('Invalid threshold');
      expect(() => detector.setForecastDeviationThreshold(NaN)).toThrow('Invalid threshold');
    });
  });

  describe('detectStorageFull', () => {
    it('should create STORAGE_FULL alert when occupancy > 90%', async () => {
      prisma.deposito.findMany.mockResolvedValue([
        {
          id: 'dep-1',
          nome: 'Armazém A',
          codigo: 'ARM-001',
          capacidadeM3: 1000,
          ocupacaoAtualM3: 950,
        },
      ]);

      await detector.detectStorageFull();

      expect(notificacaoService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'STORAGE_FULL',
          severidade: 'HIGH',
          entityId: 'dep-1',
        }),
      );
    });

    it('should set CRITICAL when occupancy > 95%', async () => {
      prisma.deposito.findMany.mockResolvedValue([
        {
          id: 'dep-2',
          nome: 'Armazém B',
          codigo: 'ARM-002',
          capacidadeM3: 100,
          ocupacaoAtualM3: 98,
        },
      ]);

      await detector.detectStorageFull();

      expect(notificacaoService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          severidade: 'CRITICAL',
        }),
      );
    });

    it('should skip warehouses with zero capacity', async () => {
      prisma.deposito.findMany.mockResolvedValue([
        {
          id: 'dep-3',
          nome: 'Empty',
          codigo: 'ARM-003',
          capacidadeM3: 0,
          ocupacaoAtualM3: 0,
        },
      ]);

      await detector.detectStorageFull();

      expect(notificacaoService.create).not.toHaveBeenCalled();
    });
  });

  describe('triggerPipelineFailure', () => {
    it('should create PIPELINE_FAILURE alert', async () => {
      await detector.triggerPipelineFailure(
        'email-listener',
        'Connection timeout',
        { jobId: 'job-1' },
      );

      expect(notificacaoService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'PIPELINE_FAILURE',
          severidade: 'CRITICAL',
          titulo: 'Falha no pipeline: email-listener',
          mensagem: 'Connection timeout',
          metadata: { pipelineName: 'email-listener', jobId: 'job-1' },
        }),
      );
    });
  });

  describe('runAllChecks', () => {
    it('should run all detection methods without throwing', async () => {
      await expect(detector.runAllChecks()).resolves.not.toThrow();
    });
  });
});
