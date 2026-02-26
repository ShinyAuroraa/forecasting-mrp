import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { createIntegrationTestApp, teardownIntegrationApp, IntegrationTestContext } from './setup-integration';

/**
 * Story 5.9 — AC-6: BOM integration test.
 * Tests create parent+child, BOM tree explosion, and version creation.
 */
describe('BOM Integration (AC-6)', () => {
  let ctx: IntegrationTestContext;
  let operatorToken: string;
  let viewerToken: string;

  const PROD_PAI_UUID = '11111111-1111-1111-1111-111111111111';
  const PROD_FILHO_UUID = '22222222-2222-2222-2222-222222222222';

  const mockBomLine = {
    id: 'bom-int-1',
    produtoPaiId: PROD_PAI_UUID,
    produtoFilhoId: PROD_FILHO_UUID,
    quantidade: 2.5,
    unidadeMedida: 'UN',
    versao: 1,
    ativo: true,
    validoDesde: new Date('2026-01-01'),
    validoAte: null,
    createdAt: new Date('2026-02-28'),
    updatedAt: new Date('2026-02-28'),
  };

  beforeAll(async () => {
    ctx = await createIntegrationTestApp({
      bom: {
        create: jest.fn().mockResolvedValue(mockBomLine),
        findMany: jest.fn().mockResolvedValue([mockBomLine]),
        findUnique: jest.fn().mockResolvedValue(mockBomLine),
        count: jest.fn().mockResolvedValue(1),
        aggregate: jest.fn().mockResolvedValue({ _max: { versao: 1 } }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      produto: {
        findUnique: jest.fn().mockResolvedValue({
          id: PROD_PAI_UUID,
          codigo: 'PAI-001',
          descricao: 'Product Parent',
        }),
      },
    });

    const jwtService = ctx.module.get(JwtService);
    operatorToken = jwtService.sign(
      { sub: 'user-1', email: 'operator@test.com', role: 'operator' },
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

  describe('POST /api/v1/bom — Create BOM line', () => {
    it('should create a BOM line with operator role', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/bom')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          produtoPaiId: PROD_PAI_UUID,
          produtoFilhoId: PROD_FILHO_UUID,
          quantidade: 2.5,
          unidadeMedida: 'UN',
        })
        .expect(201);

      expect(response.body.id).toBe('bom-int-1');
    });

    it('should reject BOM creation for viewer role', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/bom')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          produtoPaiId: PROD_PAI_UUID,
          produtoFilhoId: PROD_FILHO_UUID,
          quantidade: 2.5,
        })
        .expect(403);
    });
  });

  describe('GET /api/v1/bom/tree/:produtoPaiId — BOM Explosion', () => {
    it('should return BOM tree for a product', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get(`/api/v1/bom/tree/${PROD_PAI_UUID}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('POST /api/v1/bom/versions/:produtoPaiId — Version Creation', () => {
    it('should create a new BOM version', async () => {
      // Mock transaction for version creation
      ctx.mockPrisma.$transaction.mockImplementationOnce(async (fn: Function) => {
        const txMock = {
          bom: {
            aggregate: jest.fn().mockResolvedValue({ _max: { versao: 1 } }),
            findMany: jest.fn().mockResolvedValue([mockBomLine]),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            create: jest.fn().mockResolvedValue({ ...mockBomLine, versao: 2 }),
          },
        };
        return fn(txMock);
      });

      const response = await request(ctx.app.getHttpServer())
        .post(`/api/v1/bom/versions/${PROD_PAI_UUID}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ validoDesde: '2026-03-01' })
        .expect(201);

      expect(response.body).toBeDefined();
    });
  });

  describe('GET /api/v1/bom/versions/:produtoPaiId — Version History', () => {
    it('should return version history', async () => {
      ctx.mockPrisma.bom.findMany.mockResolvedValueOnce([
        { versao: 1, _count: { id: 3 }, _min: { createdAt: new Date() } },
      ]);

      const response = await request(ctx.app.getHttpServer())
        .get(`/api/v1/bom/versions/${PROD_PAI_UUID}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });
});
