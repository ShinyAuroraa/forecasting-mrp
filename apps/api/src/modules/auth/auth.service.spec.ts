import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';

// Mock PrismaService
const mockPrisma = {
  usuario: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

// Mock JwtService
const mockJwtService = {
  sign: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      mockPrisma as any,
      mockJwtService as any,
    );
  });

  describe('validateUser', () => {
    const validUser = {
      id: 'user-1',
      email: 'admin@test.com',
      nome: 'Admin',
      senhaHash: bcrypt.hashSync('password123', 12),
      role: 'admin',
      ativo: true,
    };

    it('should return user data when credentials are valid', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue(validUser);

      const result = await service.validateUser('admin@test.com', 'password123');

      expect(result).toEqual({
        id: 'user-1',
        email: 'admin@test.com',
        nome: 'Admin',
        role: 'admin',
      });
    });

    it('should return null when user is not found', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('noone@test.com', 'password123');
      expect(result).toBeNull();
    });

    it('should return null when user is inactive', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue({
        ...validUser,
        ativo: false,
      });

      const result = await service.validateUser('admin@test.com', 'password123');
      expect(result).toBeNull();
    });

    it('should return null when password is incorrect', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue(validUser);

      const result = await service.validateUser('admin@test.com', 'wrongpassword');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should generate tokens and store refresh hash', async () => {
      mockJwtService.sign
        .mockReturnValueOnce('access-token-123')
        .mockReturnValueOnce('refresh-token-456');
      mockPrisma.usuario.update.mockResolvedValue({});

      const user = { id: 'user-1', email: 'admin@test.com', role: 'admin' };
      const result = await service.login(user);

      expect(result.accessToken).toBe('access-token-123');
      expect(result.refreshToken).toBe('refresh-token-456');
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
      expect(mockPrisma.usuario.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          refreshTokenHash: createHash('sha256')
            .update('refresh-token-456')
            .digest('hex'),
        },
      });
    });
  });

  describe('refreshTokens', () => {
    it('should generate new tokens when refresh token is valid', async () => {
      const refreshToken = 'valid-refresh-token';
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

      mockPrisma.usuario.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@test.com',
        role: 'admin',
        ativo: true,
        refreshTokenHash: tokenHash,
      });

      mockJwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');
      mockPrisma.usuario.update.mockResolvedValue({});

      const result = await service.refreshTokens('user-1', refreshToken);

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(mockPrisma.usuario.update).toHaveBeenCalled();
    });

    it('should throw when user not found', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue(null);

      await expect(
        service.refreshTokens('user-1', 'token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when user is inactive', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue({
        id: 'user-1',
        ativo: false,
        refreshTokenHash: 'hash',
      });

      await expect(
        service.refreshTokens('user-1', 'token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when refresh token hash does not match', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@test.com',
        role: 'admin',
        ativo: true,
        refreshTokenHash: 'wrong-hash',
      });

      await expect(
        service.refreshTokens('user-1', 'some-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should clear refresh token hash', async () => {
      mockPrisma.usuario.update.mockResolvedValue({});

      await service.logout('user-1');

      expect(mockPrisma.usuario.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { refreshTokenHash: null },
      });
    });
  });

  describe('hashPassword', () => {
    it('should hash the password with bcrypt', async () => {
      const hash = await service.hashPassword('mypassword');

      expect(hash).toBeDefined();
      expect(hash).not.toBe('mypassword');
      expect(await bcrypt.compare('mypassword', hash)).toBe(true);
    });
  });
});
