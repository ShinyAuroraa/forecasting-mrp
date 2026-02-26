import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';

const mockAuthService = {
  validateUser: jest.fn(),
  login: jest.fn(),
  refreshTokens: jest.fn(),
  logout: jest.fn(),
};

const mockResponse = {
  cookie: jest.fn(),
  clearCookie: jest.fn(),
} as any;

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(mockAuthService as any);
  });

  describe('POST /auth/login', () => {
    it('should return access token and set refresh cookie on valid login', async () => {
      const user = { id: '1', email: 'admin@test.com', role: 'admin' };
      mockAuthService.validateUser.mockResolvedValue(user);
      mockAuthService.login.mockResolvedValue({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
      });

      const result = await controller.login(
        { email: 'admin@test.com', password: 'password123' },
        mockResponse,
      );

      expect(result).toEqual({ accessToken: 'access-123' });
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-456',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(
        controller.login(
          { email: 'bad@test.com', password: 'wrong' },
          mockResponse,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return new tokens', async () => {
      mockAuthService.refreshTokens.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });

      const result = await controller.refresh(
        { id: 'user-1', refreshToken: 'old-refresh' },
        mockResponse,
      );

      expect(result).toEqual({ accessToken: 'new-access' });
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'new-refresh',
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  describe('POST /auth/logout', () => {
    it('should clear refresh token and cookie', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout('user-1', mockResponse);

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(mockAuthService.logout).toHaveBeenCalledWith('user-1');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user', () => {
      const user = { id: '1', email: 'admin@test.com', nome: 'Admin', role: 'admin' };
      expect(controller.getProfile(user)).toBe(user);
    });
  });
});
