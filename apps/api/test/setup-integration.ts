import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Story 5.9 — AC-2: Integration test setup utility.
 *
 * Creates a full NestJS application instance with mocked Prisma service
 * for integration testing. This allows testing the full controller→service→prisma
 * chain without requiring a real database.
 */
export interface IntegrationTestContext {
  app: INestApplication;
  module: TestingModule;
  mockPrisma: Record<string, any>;
}

/**
 * Create a fresh NestJS app for integration testing.
 * Overrides PrismaService with a mock to avoid requiring a real database.
 */
export async function createIntegrationTestApp(
  prismaOverrides: Record<string, any> = {},
): Promise<IntegrationTestContext> {
  const mockPrisma = createMockPrisma(prismaOverrides);

  const module = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(mockPrisma)
    .compile();

  const app = module.createNestApplication();

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.init();

  return { app, module, mockPrisma };
}

/**
 * Create a mock Prisma service with default empty implementations.
 * Individual tests can override specific model methods via prismaOverrides.
 */
function createMockPrisma(overrides: Record<string, any> = {}): Record<string, any> {
  const defaultModelMethods = () => ({
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: {}, _avg: {}, _min: {}, _max: {}, _count: {} }),
    groupBy: jest.fn().mockResolvedValue([]),
    upsert: jest.fn().mockResolvedValue({}),
  });

  // All known Prisma models from the schema
  const modelNames = [
    'usuario', 'produto', 'fornecedor', 'produtoFornecedor',
    'bom', 'centroTrabalho', 'turno', 'paradaProgramada',
    'eventoCapacidade', 'inventarioAtual', 'historicoEstoque',
    'armazem', 'ingestaoHistorico', 'templateMapeamento',
    'campoMapeamento', 'configSistema', 'skuClassification',
    'serieTemporal', 'forecastModelo', 'forecastResultado',
    'forecastMetrica', 'forecastOverride', 'roteiroProducao',
    'calendarioFabrica', 'mrpExecucao', 'necessidadeLiquida',
    'ordemPlanejada', 'mensagemAcao', 'cargaRecurso',
    'notificacao', 'connectorConfig', 'pipelineExecucao',
    'emailIngestao', 'cenario', 'cenarioResultado',
    'historicoLeadTime', 'atividadeUsuario',
  ];

  const mock: Record<string, any> = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn().mockImplementation((fn: Function) => fn(mock)),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(0),
  };

  for (const name of modelNames) {
    mock[name] = { ...defaultModelMethods(), ...(overrides[name] ?? {}) };
  }

  return mock;
}

/**
 * Cleanup integration test app.
 */
export async function teardownIntegrationApp(ctx: IntegrationTestContext): Promise<void> {
  await ctx.app.close();
}
