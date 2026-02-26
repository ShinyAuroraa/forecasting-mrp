import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { createIntegrationTestApp, teardownIntegrationApp, IntegrationTestContext } from './setup-integration';

/**
 * Story 5.9 — AC-7: Forecast override integration test.
 * Tests create override→list→revert lifecycle.
 */
describe('Forecast Override Integration (AC-7)', () => {
  let ctx: IntegrationTestContext;
  let operatorToken: string;

  const mockOverride = {
    id: 'ov-int-1',
    produtoId: 'prod-1',
    usuarioId: 'user-1',
    periodoInicio: new Date('2026-03-01'),
    periodoFim: new Date('2026-03-31'),
    overrideP50: 1000,
    originalP50: 800,
    justificativa: 'Integration test override',
    categoria: 'AJUSTE_MERCADO',
    ativo: true,
    revertedFromId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    ctx = await createIntegrationTestApp({
      forecastOverride: {
        create: jest.fn().mockResolvedValue(mockOverride),
        findMany: jest.fn().mockResolvedValue([mockOverride]),
        findUnique: jest.fn().mockResolvedValue(mockOverride),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue({ ...mockOverride, ativo: false }),
      },
      forecastResultado: {
        findFirst: jest.fn().mockResolvedValue({ p50: 800 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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

  describe('POST /api/v1/forecast/overrides — Create Override', () => {
    it('should create a forecast override', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/forecast/overrides')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          produtoId: 'prod-1',
          periodoInicio: '2026-03-01',
          periodoFim: '2026-03-31',
          overrideP50: 1000,
          justificativa: 'Integration test override',
          categoria: 'AJUSTE_MERCADO',
        })
        .expect(201);

      expect(response.body.id).toBe('ov-int-1');
      expect(response.body.overrideP50).toBe(1000);
    });

    it('should reject with missing required fields', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/forecast/overrides')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ produtoId: 'prod-1' })
        .expect(400);
    });
  });

  describe('GET /api/v1/forecast/overrides — List Overrides', () => {
    it('should return paginated overrides', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/forecast/overrides')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should accept filter parameters', async () => {
      await request(ctx.app.getHttpServer())
        .get('/api/v1/forecast/overrides?produtoId=prod-1&ativo=true')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);
    });
  });

  describe('POST /api/v1/forecast/overrides/:id/revert — Revert Override', () => {
    it('should successfully revert an active override', async () => {
      const OVERRIDE_UUID = '33333333-3333-3333-3333-333333333333';
      ctx.mockPrisma.forecastOverride.findUnique.mockResolvedValueOnce({
        ...mockOverride,
        id: OVERRIDE_UUID,
      });
      ctx.mockPrisma.forecastOverride.update.mockResolvedValueOnce({
        ...mockOverride,
        id: OVERRIDE_UUID,
        ativo: false,
      });

      const response = await request(ctx.app.getHttpServer())
        .post(`/api/v1/forecast/overrides/${OVERRIDE_UUID}/revert`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(response.body.ativo).toBe(false);
    });

    it('should reject without valid UUID', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/forecast/overrides/not-a-uuid/revert')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(400);
    });
  });
});
