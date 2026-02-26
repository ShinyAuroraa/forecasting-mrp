import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { createIntegrationTestApp, teardownIntegrationApp, IntegrationTestContext } from './setup-integration';

/**
 * Story 5.9 — AC-8: Export integration test.
 * Tests PDF/Excel generation with valid parameters.
 */
describe('Export Integration (AC-8)', () => {
  let ctx: IntegrationTestContext;
  let operatorToken: string;

  beforeAll(async () => {
    ctx = await createIntegrationTestApp({
      ordemPlanejada: {
        count: jest.fn().mockResolvedValue(42),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { custoEstimado: 150000 },
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      forecastMetrica: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      fornecedor: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    const jwtService = ctx.module.get(JwtService);
    operatorToken = jwtService.sign(
      { sub: 'user-1', email: 'operator@test.com', role: 'operator' },
      { expiresIn: '1h' },
    );
  });

  afterAll(async () => {
    await teardownIntegrationApp(ctx);
  });

  describe('POST /api/v1/export — Request Export', () => {
    it('should accept a valid Excel export request', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/export')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          type: 'MRP_SUMMARY',
          format: 'EXCEL',
          filters: {},
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body).toBeDefined();
      if (response.body.jobId) {
        expect(typeof response.body.jobId).toBe('string');
      }
    });

    it('should accept a valid PDF export request', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/export')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          type: 'EXECUTIVE_DASHBOARD',
          format: 'PDF',
          filters: {},
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body).toBeDefined();
    });

    it('should reject without authentication', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/export')
        .send({ type: 'MRP_SUMMARY', format: 'PDF', filters: {} })
        .expect(401);
    });
  });
});
