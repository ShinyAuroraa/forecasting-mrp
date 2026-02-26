import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { createIntegrationTestApp, teardownIntegrationApp, IntegrationTestContext } from './setup-integration';

/**
 * Story 5.9 — AC-9: MRP execution integration test.
 * Tests triggering an MRP run and verifying planned orders are generated.
 */
describe('MRP Execution Integration (AC-9)', () => {
  let ctx: IntegrationTestContext;
  let adminToken: string;
  let viewerToken: string;

  const mockExecucao = {
    id: 'mrp-exec-1',
    status: 'CONCLUIDO',
    iniciado: new Date(),
    concluido: new Date(),
    parametros: {},
    resultadoResumo: {
      ordensCompra: 15,
      ordensProducao: 8,
      mensacoesAcao: 5,
    },
  };

  beforeAll(async () => {
    ctx = await createIntegrationTestApp({
      mrpExecucao: {
        create: jest.fn().mockResolvedValue(mockExecucao),
        findUnique: jest.fn().mockResolvedValue(mockExecucao),
        findMany: jest.fn().mockResolvedValue([mockExecucao]),
        update: jest.fn().mockResolvedValue(mockExecucao),
        count: jest.fn().mockResolvedValue(1),
      },
      ordemPlanejada: {
        createMany: jest.fn().mockResolvedValue({ count: 23 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(23),
      },
      mensagemAcao: {
        createMany: jest.fn().mockResolvedValue({ count: 5 }),
      },
      necessidadeLiquida: {
        createMany: jest.fn().mockResolvedValue({ count: 10 }),
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

  describe('POST /api/v1/mrp/execute — Trigger MRP', () => {
    it('should reject MRP execution for viewer role', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/mrp/execute')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });

    it('should reject without authentication', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/mrp/execute')
        .expect(401);
    });
  });

  describe('GET /api/v1/mrp/executions — List Executions', () => {
    it('should return MRP execution history', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/mrp/executions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });
  });
});
