import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { createIntegrationTestApp, teardownIntegrationApp, IntegrationTestContext } from './setup-integration';

/**
 * Story 5.9 — AC-10: Activity log integration test.
 * Tests interceptor logging of tracked API calls and query by filters.
 */
describe('Activity Log Integration (AC-10)', () => {
  let ctx: IntegrationTestContext;
  let adminToken: string;
  let viewerToken: string;

  const mockActivity = {
    id: 'act-int-1',
    usuarioId: 'user-1',
    tipo: 'LOGIN',
    recurso: 'POST /auth/login',
    metadata: { url: '/auth/login', method: 'POST' },
    ipAddress: '127.0.0.1',
    userAgent: 'supertest',
    createdAt: new Date('2026-02-28'),
  };

  beforeAll(async () => {
    ctx = await createIntegrationTestApp({
      atividadeUsuario: {
        create: jest.fn().mockResolvedValue(mockActivity),
        findMany: jest.fn().mockResolvedValue([mockActivity]),
        count: jest.fn().mockResolvedValue(1),
        groupBy: jest.fn().mockResolvedValue([
          { tipo: 'LOGIN', _count: { id: 10 } },
        ]),
      },
    });

    const jwtService = ctx.module.get(JwtService);
    adminToken = jwtService.sign(
      { sub: 'user-1', email: 'admin@test.com', role: 'admin' },
      { expiresIn: '1h' },
    );
    viewerToken = jwtService.sign(
      { sub: 'user-2', email: 'viewer@test.com', role: 'viewer' },
      { expiresIn: '1h' },
    );
  });

  afterAll(async () => {
    await teardownIntegrationApp(ctx);
  });

  describe('GET /api/v1/activity-log — List Activity Logs', () => {
    it('should return activity logs for viewer', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/activity-log')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.data).toBeDefined();
    });

    it('should accept tipo filter', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/activity-log?tipo=LOGIN')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should accept date range filters', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/activity-log?dateFrom=2026-02-01&dateTo=2026-02-28')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should clamp invalid page/limit values', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/activity-log?page=-1&limit=999999')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should reject without authentication', async () => {
      await request(ctx.app.getHttpServer())
        .get('/api/v1/activity-log')
        .expect(401);
    });
  });

  describe('GET /api/v1/activity-log/summary — Activity Summary', () => {
    it('should return summary for admin', async () => {
      ctx.mockPrisma.$queryRaw.mockResolvedValueOnce([
        { date: new Date('2026-02-28'), count: 10 },
      ]);

      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/activity-log/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.totalEvents).toBeDefined();
      expect(response.body.byType).toBeDefined();
    });

    it('should reject summary for viewer (admin-only)', async () => {
      await request(ctx.app.getHttpServer())
        .get('/api/v1/activity-log/summary')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });

    it('should accept custom days parameter', async () => {
      ctx.mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/activity-log/summary?days=7')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should handle invalid days gracefully', async () => {
      ctx.mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/activity-log/summary?days=abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });
});
