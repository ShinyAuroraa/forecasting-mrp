import { Test, TestingModule } from '@nestjs/testing';
import { NotificacaoService } from './notificacao.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateAlertDto } from './notification.types';

describe('NotificacaoService', () => {
  let service: NotificacaoService;
  let prisma: jest.Mocked<PrismaService>;

  const mockAlert = {
    id: 'uuid-1',
    tipo: 'STOCKOUT',
    severidade: 'CRITICAL',
    titulo: 'Ruptura de estoque',
    mensagem: 'Produto X com estoque negativo',
    entityId: 'prod-1',
    entityType: 'Produto',
    metadata: {},
    acknowledgedAt: null,
    acknowledgedBy: null,
    createdAt: new Date('2026-02-26T10:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificacaoService,
        {
          provide: PrismaService,
          useValue: {
            notificacao: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<NotificacaoService>(NotificacaoService);
    prisma = module.get(PrismaService);
  });

  describe('create', () => {
    it('should persist alert and return it', async () => {
      (prisma.notificacao.create as jest.Mock).mockResolvedValue(mockAlert);

      const dto: CreateAlertDto = {
        tipo: 'STOCKOUT',
        severidade: 'CRITICAL',
        titulo: 'Ruptura de estoque',
        mensagem: 'Produto X com estoque negativo',
        entityId: 'prod-1',
        entityType: 'Produto',
      };

      const result = await service.create(dto);

      expect(prisma.notificacao.create).toHaveBeenCalledWith({
        data: {
          tipo: 'STOCKOUT',
          severidade: 'CRITICAL',
          titulo: 'Ruptura de estoque',
          mensagem: 'Produto X com estoque negativo',
          entityId: 'prod-1',
          entityType: 'Produto',
          metadata: {},
        },
      });
      expect(result).toEqual(mockAlert);
    });

    it('should notify all subscribers on create', async () => {
      (prisma.notificacao.create as jest.Mock).mockResolvedValue(mockAlert);
      const subscriber = jest.fn();
      service.onNewAlert(subscriber);

      await service.create({
        tipo: 'STOCKOUT',
        severidade: 'CRITICAL',
        titulo: 'Test',
        mensagem: 'Test msg',
      });

      expect(subscriber).toHaveBeenCalledWith(mockAlert);
    });

    it('should not throw if subscriber errors', async () => {
      (prisma.notificacao.create as jest.Mock).mockResolvedValue(mockAlert);
      const badSubscriber = jest.fn(() => { throw new Error('fail'); });
      service.onNewAlert(badSubscriber);

      await expect(service.create({
        tipo: 'STOCKOUT',
        severidade: 'CRITICAL',
        titulo: 'Test',
        mensagem: 'Test msg',
      })).resolves.toEqual(mockAlert);
    });
  });

  describe('onNewAlert', () => {
    it('should return unsubscribe function', () => {
      const subscriber = jest.fn();
      const unsubscribe = service.onNewAlert(subscriber);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('findAll', () => {
    it('should list alerts with filters', async () => {
      (prisma.notificacao.findMany as jest.Mock).mockResolvedValue([mockAlert]);
      (prisma.notificacao.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll({ tipo: 'STOCKOUT' });

      expect(result).toEqual({ data: [mockAlert], total: 1 });
      expect(prisma.notificacao.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tipo: 'STOCKOUT' },
          orderBy: { createdAt: 'desc' },
          take: 50,
          skip: 0,
        }),
      );
    });

    it('should filter by acknowledged=false', async () => {
      (prisma.notificacao.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.notificacao.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({ acknowledged: false });

      expect(prisma.notificacao.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { acknowledgedAt: null },
        }),
      );
    });

    it('should filter by date range', async () => {
      (prisma.notificacao.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.notificacao.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({
        since: '2026-01-01T00:00:00Z',
        until: '2026-02-01T00:00:00Z',
      });

      expect(prisma.notificacao.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            createdAt: {
              gte: new Date('2026-01-01T00:00:00Z'),
              lte: new Date('2026-02-01T00:00:00Z'),
            },
          },
        }),
      );
    });
  });

  describe('acknowledge', () => {
    it('should update alert with acknowledgedAt and acknowledgedBy', async () => {
      (prisma.notificacao.findUnique as jest.Mock).mockResolvedValue(mockAlert);
      const acknowledged = { ...mockAlert, acknowledgedAt: new Date(), acknowledgedBy: 'user-1' };
      (prisma.notificacao.update as jest.Mock).mockResolvedValue(acknowledged);

      const result = await service.acknowledge('uuid-1', 'user-1');

      expect(prisma.notificacao.findUnique).toHaveBeenCalledWith({ where: { id: 'uuid-1' } });
      expect(prisma.notificacao.update).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
        data: {
          acknowledgedAt: expect.any(Date),
          acknowledgedBy: 'user-1',
        },
      });
      expect(result.acknowledgedBy).toBe('user-1');
    });

    it('should throw NotFoundException when alert does not exist', async () => {
      (prisma.notificacao.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.acknowledge('non-existent', 'user-1'))
        .rejects.toThrow('Alert non-existent not found');
    });
  });

  describe('getSummary', () => {
    it('should return counts by type and severity', async () => {
      (prisma.notificacao.findMany as jest.Mock).mockResolvedValue([
        { tipo: 'STOCKOUT', severidade: 'CRITICAL' },
        { tipo: 'STOCKOUT', severidade: 'HIGH' },
        { tipo: 'CAPACITY_OVERLOAD', severidade: 'HIGH' },
      ]);

      const result = await service.getSummary();

      expect(result.totalUnacknowledged).toBe(3);
      expect(result.byType.STOCKOUT).toBe(2);
      expect(result.byType.CAPACITY_OVERLOAD).toBe(1);
      expect(result.bySeverity.CRITICAL).toBe(1);
      expect(result.bySeverity.HIGH).toBe(2);
    });

    it('should return zeros when no unacknowledged alerts', async () => {
      (prisma.notificacao.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getSummary();

      expect(result.totalUnacknowledged).toBe(0);
      expect(result.byType.STOCKOUT).toBe(0);
      expect(result.bySeverity.CRITICAL).toBe(0);
    });
  });
});
