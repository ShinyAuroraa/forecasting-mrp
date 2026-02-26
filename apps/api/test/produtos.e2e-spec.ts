import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { createIntegrationTestApp, teardownIntegrationApp, IntegrationTestContext } from './setup-integration';

/**
 * Story 5.9 — AC-5: Product CRUD integration test.
 * Tests the full create→read→update→delete lifecycle.
 */
describe('Product CRUD Integration (AC-5)', () => {
  let ctx: IntegrationTestContext;
  let jwtToken: string;

  const mockProduct = {
    id: 'prod-int-1',
    codigo: 'SKU-001',
    descricao: 'Integration Test Product',
    unidadeMedida: 'UN',
    tipo: 'ACABADO',
    ativo: true,
    custoMedioUnitario: 10.5,
    createdAt: new Date('2026-02-28'),
    updatedAt: new Date('2026-02-28'),
  };

  beforeAll(async () => {
    ctx = await createIntegrationTestApp({
      produto: {
        create: jest.fn().mockResolvedValue(mockProduct),
        findMany: jest.fn().mockResolvedValue([mockProduct]),
        findUnique: jest.fn().mockResolvedValue(mockProduct),
        update: jest.fn().mockResolvedValue({ ...mockProduct, descricao: 'Updated Product' }),
        delete: jest.fn().mockResolvedValue(mockProduct),
        count: jest.fn().mockResolvedValue(1),
      },
    });

    // Generate a valid JWT for authenticated requests
    const jwtService = ctx.module.get(JwtService);
    jwtToken = jwtService.sign(
      { sub: 'user-1', email: 'admin@test.com', role: 'admin' },
      { expiresIn: '1h' },
    );
  });

  afterAll(async () => {
    await teardownIntegrationApp(ctx);
  });

  describe('POST /api/v1/produtos — Create', () => {
    it('should create a product with valid data', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/produtos')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          codigo: 'SKU-001',
          descricao: 'Integration Test Product',
          unidadeMedida: 'UN',
          tipo: 'ACABADO',
        })
        .expect(201);

      expect(response.body.id).toBe('prod-int-1');
      expect(response.body.codigo).toBe('SKU-001');
    });

    it('should reject creation with missing required fields', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/produtos')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ descricao: 'Missing required fields' })
        .expect(400);
    });
  });

  describe('GET /api/v1/produtos — List', () => {
    it('should return paginated product list', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/produtos')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('GET /api/v1/produtos/:id — Read', () => {
    it('should return a single product by ID', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/produtos/prod-int-1')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(response.body.id).toBe('prod-int-1');
    });

    it('should return 400 for non-UUID id', async () => {
      await request(ctx.app.getHttpServer())
        .get('/api/v1/produtos/nonexistent-id')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(400); // UuidValidationPipe rejects non-UUID
    });

    it('should return 404 for valid UUID that does not exist', async () => {
      ctx.mockPrisma.produto.findUnique.mockResolvedValueOnce(null);

      await request(ctx.app.getHttpServer())
        .get('/api/v1/produtos/99999999-9999-9999-9999-999999999999')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/produtos/:id — Update', () => {
    it('should update a product', async () => {
      const response = await request(ctx.app.getHttpServer())
        .patch('/api/v1/produtos/prod-int-1')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ descricao: 'Updated Product' })
        .expect(200);

      expect(response.body.descricao).toBe('Updated Product');
    });
  });

  describe('DELETE /api/v1/produtos/:id — Delete', () => {
    it('should soft-delete a product (admin only)', async () => {
      await request(ctx.app.getHttpServer())
        .delete('/api/v1/produtos/prod-int-1')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(204);
    });

    it('should reject delete for viewer role', async () => {
      const jwtService = ctx.module.get(JwtService);
      const viewerToken = jwtService.sign(
        { sub: 'user-2', email: 'viewer@test.com', role: 'viewer' },
        { expiresIn: '1h' },
      );

      await request(ctx.app.getHttpServer())
        .delete('/api/v1/produtos/prod-int-1')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });
  });
});
