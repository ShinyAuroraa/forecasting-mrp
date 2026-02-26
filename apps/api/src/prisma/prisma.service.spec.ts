import { PrismaService } from './prisma.service';

// We must mock both PrismaPg and the generated PrismaClient since
// Prisma 7 validates the adapter at construction time.
jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({
    provider: 'postgres',
    adapterName: '@prisma/adapter-pg',
  })),
}));

jest.mock('../generated/prisma/client', () => {
  const mockConnect = jest.fn().mockResolvedValue(undefined);
  const mockDisconnect = jest.fn().mockResolvedValue(undefined);

  return {
    PrismaClient: jest.fn().mockImplementation(function (this: any) {
      this.$connect = mockConnect;
      this.$disconnect = mockDisconnect;
    }),
    Prisma: {
      PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
        code: string;
        meta?: Record<string, unknown>;
        clientVersion: string;
        constructor(message: string, opts: { code: string; clientVersion: string; meta?: Record<string, unknown> }) {
          super(message);
          this.code = opts.code;
          this.clientVersion = opts.clientVersion;
          this.meta = opts.meta;
        }
      },
    },
  };
});

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    process.env['DATABASE_URL'] =
      'postgresql://test:test@localhost:5434/test_db';
    service = new PrismaService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call $connect on module init', async () => {
    await service.onModuleInit();
    expect(service.$connect).toHaveBeenCalled();
  });

  it('should call $disconnect on module destroy', async () => {
    await service.onModuleDestroy();
    expect(service.$disconnect).toHaveBeenCalled();
  });
});
