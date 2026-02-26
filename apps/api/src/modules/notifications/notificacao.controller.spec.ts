import { Test, TestingModule } from '@nestjs/testing';
import { NotificacaoController } from './notificacao.controller';
import { NotificacaoService } from './notificacao.service';

describe('NotificacaoController', () => {
  let controller: NotificacaoController;
  let service: jest.Mocked<NotificacaoService>;

  const mockAlert = {
    id: 'uuid-1',
    tipo: 'STOCKOUT',
    severidade: 'CRITICAL',
    titulo: 'Ruptura',
    mensagem: 'Estoque negativo',
    entityId: null,
    entityType: null,
    metadata: {},
    acknowledgedAt: null,
    acknowledgedBy: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificacaoController],
      providers: [
        {
          provide: NotificacaoService,
          useValue: {
            findAll: jest.fn(),
            getSummary: jest.fn(),
            acknowledge: jest.fn(),
            onNewAlert: jest.fn(() => jest.fn()),
          },
        },
      ],
    }).compile();

    controller = module.get<NotificacaoController>(NotificacaoController);
    service = module.get(NotificacaoService);
  });

  describe('GET /alerts', () => {
    it('should return paginated alert list', async () => {
      const response = { data: [mockAlert], total: 1 };
      service.findAll.mockResolvedValue(response);

      const result = await controller.findAll({ limit: 50, offset: 0 });

      expect(result).toEqual(response);
      expect(service.findAll).toHaveBeenCalledWith({ limit: 50, offset: 0 });
    });

    it('should pass filter parameters', async () => {
      service.findAll.mockResolvedValue({ data: [], total: 0 });

      await controller.findAll({
        tipo: 'STOCKOUT',
        severidade: 'CRITICAL',
        acknowledged: false,
      });

      expect(service.findAll).toHaveBeenCalledWith({
        tipo: 'STOCKOUT',
        severidade: 'CRITICAL',
        acknowledged: false,
      });
    });
  });

  describe('GET /alerts/summary', () => {
    it('should return alert summary', async () => {
      const summary = {
        byType: { STOCKOUT: 2, URGENT_PURCHASE: 0, CAPACITY_OVERLOAD: 0, FORECAST_DEVIATION: 0, STORAGE_FULL: 0, PIPELINE_FAILURE: 0 },
        bySeverity: { CRITICAL: 1, HIGH: 1, MEDIUM: 0, LOW: 0, INFO: 0 },
        totalUnacknowledged: 2,
      };
      service.getSummary.mockResolvedValue(summary);

      const result = await controller.getSummary();

      expect(result).toEqual(summary);
    });
  });

  describe('PATCH /alerts/:id/acknowledge', () => {
    it('should acknowledge alert with userId from JWT', async () => {
      const acked = { ...mockAlert, acknowledgedAt: new Date(), acknowledgedBy: 'user-42' };
      service.acknowledge.mockResolvedValue(acked);

      const mockReq = { user: { sub: 'user-42' } } as any;
      const result = await controller.acknowledge('uuid-1', mockReq);

      expect(result.acknowledgedAt).toBeTruthy();
      expect(service.acknowledge).toHaveBeenCalledWith('uuid-1', 'user-42');
    });

    it('should fallback to unknown if no user in request', async () => {
      const acked = { ...mockAlert, acknowledgedAt: new Date(), acknowledgedBy: 'unknown' };
      service.acknowledge.mockResolvedValue(acked);

      const mockReq = {} as any;
      const result = await controller.acknowledge('uuid-1', mockReq);

      expect(service.acknowledge).toHaveBeenCalledWith('uuid-1', 'unknown');
      expect(result.acknowledgedBy).toBe('unknown');
    });
  });

  describe('GET /alerts/stream (SSE)', () => {
    it('should return an Observable', () => {
      const observable = controller.stream();
      expect(observable).toBeDefined();
      expect(typeof observable.subscribe).toBe('function');
    });
  });
});
