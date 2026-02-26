import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

const mockPrisma = {
  usuario: {
    findUnique: jest.fn(),
  },
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['JWT_SECRET'] = 'test-secret';
    strategy = new JwtStrategy(mockPrisma as any);
  });

  it('should return user payload when user exists and is active', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@test.com',
      nome: 'Admin',
      role: 'admin',
      ativo: true,
    });

    const result = await strategy.validate({
      sub: 'user-1',
      email: 'admin@test.com',
      role: 'admin',
    });

    expect(result).toEqual({
      id: 'user-1',
      email: 'admin@test.com',
      nome: 'Admin',
      role: 'admin',
    });
  });

  it('should throw UnauthorizedException when user not found', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'nonexistent', email: 'x@x.com', role: 'admin' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when user is inactive', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@test.com',
      nome: 'Admin',
      role: 'admin',
      ativo: false,
    });

    await expect(
      strategy.validate({ sub: 'user-1', email: 'admin@test.com', role: 'admin' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
