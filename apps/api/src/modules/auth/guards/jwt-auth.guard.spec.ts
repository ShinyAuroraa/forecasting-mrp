import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

// Mock @nestjs/passport to avoid Passport strategy initialization
jest.mock('@nestjs/passport', () => ({
  AuthGuard: () => {
    class MockAuthGuard {
      canActivate() {
        return true;
      }
    }
    return MockAuthGuard;
  },
}));

// Re-import after mock
const { JwtAuthGuard: MockedJwtAuthGuard } =
  jest.requireActual('./jwt-auth.guard') as any;

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    // Clear module cache to pick up mock
    jest.resetModules();
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  const createMockContext = (): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({}),
        getResponse: jest.fn().mockReturnValue({}),
        getNext: jest.fn(),
      }),
    }) as unknown as ExecutionContext;

  it('should allow access when @Public() is set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

    const context = createMockContext();
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException when no user provided', () => {
    expect(() => guard.handleRequest(null, null, undefined)).toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException with info message', () => {
    const info = new Error('jwt expired');
    try {
      guard.handleRequest(null, null, info);
      fail('Expected UnauthorizedException');
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).message).toBe('jwt expired');
    }
  });

  it('should throw UnauthorizedException when error is provided', () => {
    const err = new Error('some error');
    expect(() => guard.handleRequest(err, null, undefined)).toThrow(
      UnauthorizedException,
    );
  });

  it('should return user when valid', () => {
    const user = { id: '1', email: 'test@test.com', role: 'admin' };
    expect(guard.handleRequest(null, user, undefined)).toBe(user);
  });

  it('should return default message when no info provided', () => {
    try {
      guard.handleRequest(null, null, undefined);
      fail('Expected UnauthorizedException');
    } catch (error) {
      expect((error as UnauthorizedException).message).toBe(
        'Authentication required',
      );
    }
  });
});
