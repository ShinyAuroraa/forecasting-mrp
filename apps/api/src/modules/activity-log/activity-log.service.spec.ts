import { Test, TestingModule } from '@nestjs/testing';
import { ActivityLogService } from './activity-log.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ActivityLogService', () => {
  let service: ActivityLogService;
  let mockAtividadeUsuario: Record<string, jest.Mock>;
  let mockPrisma: Record<string, unknown>;

  const mockActivity = {
    id: 'act-1',
    usuarioId: 'user-1',
    tipo: 'LOGIN',
    recurso: 'POST /auth/login',
    metadata: { url: '/auth/login', method: 'POST' },
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date('2026-02-28'),
  };

  beforeEach(async () => {
    mockAtividadeUsuario = {
      create: jest.fn().mockResolvedValue(mockActivity),
      findMany: jest.fn().mockResolvedValue([mockActivity]),
      count: jest.fn().mockResolvedValue(1),
      groupBy: jest.fn().mockResolvedValue([
        { tipo: 'LOGIN', _count: { id: 15 } },
        { tipo: 'EXPORT', _count: { id: 5 } },
      ]),
    };

    mockPrisma = {
      atividadeUsuario: mockAtividadeUsuario,
      $queryRaw: jest.fn().mockResolvedValue([
        { date: new Date('2026-02-28'), count: 10 },
        { date: new Date('2026-02-27'), count: 8 },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityLogService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ActivityLogService>(ActivityLogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- AC-6: log ---

  describe('log — AC-6', () => {
    it('should record an activity event', async () => {
      const result = await service.log({
        usuarioId: 'user-1',
        tipo: 'LOGIN',
        recurso: 'POST /auth/login',
        ipAddress: '127.0.0.1',
      });

      expect(result).toEqual(mockActivity);
      expect(mockAtividadeUsuario.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            usuarioId: 'user-1',
            tipo: 'LOGIN',
          }),
        }),
      );
    });

    it('should handle optional fields as null', async () => {
      await service.log({ tipo: 'PAGE_VIEW' });

      expect(mockAtividadeUsuario.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            usuarioId: null,
            recurso: null,
            metadata: null,
            ipAddress: null,
            userAgent: null,
          }),
        }),
      );
    });
  });

  // --- AC-7: getByUser ---

  describe('getByUser — AC-7', () => {
    it('should return paginated activity for a user', async () => {
      const result = await service.getByUser('user-1');

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockAtividadeUsuario.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { usuarioId: 'user-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  // --- AC-10: findAll ---

  describe('findAll — AC-10', () => {
    it('should apply tipo filter', async () => {
      await service.findAll({ tipo: 'LOGIN' });

      expect(mockAtividadeUsuario.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tipo: 'LOGIN',
          }),
        }),
      );
    });

    it('should apply date range filter', async () => {
      await service.findAll({
        dateFrom: '2026-02-01',
        dateTo: '2026-02-28',
      });

      expect(mockAtividadeUsuario.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2026-02-01'),
              lte: new Date('2026-02-28'),
            },
          }),
        }),
      );
    });

    it('should return empty results', async () => {
      mockAtividadeUsuario.findMany.mockResolvedValue([]);
      mockAtividadeUsuario.count.mockResolvedValue(0);

      const result = await service.findAll({});
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  // --- AC-8: getSummary ---

  describe('getSummary — AC-8', () => {
    it('should return aggregated activity summary', async () => {
      const result = await service.getSummary();

      expect(result.totalEvents).toBe(1);
      expect(result.byType).toHaveLength(2);
      expect(result.byType[0].tipo).toBe('LOGIN');
      expect(result.byType[0].count).toBe(15);
      expect(result.recentDays).toHaveLength(2);
    });

    it('should accept custom days parameter', async () => {
      await service.getSummary(7);

      expect(mockAtividadeUsuario.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });
});
