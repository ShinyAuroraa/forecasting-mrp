import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockContext = (user?: Record<string, unknown>): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    }) as unknown as ExecutionContext;

  it('should allow access when @Public() is set', () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(true);

    expect(guard.canActivate(createMockContext())).toBe(true);
  });

  it('should allow access when no roles are specified', () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)  // isPublic
      .mockReturnValueOnce(null);  // roles

    expect(guard.canActivate(createMockContext({ role: 'viewer' }))).toBe(true);
  });

  it('should allow admin to access viewer endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)     // isPublic
      .mockReturnValueOnce(['viewer']); // roles

    const context = createMockContext({ role: 'admin' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow manager to access operator endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)       // isPublic
      .mockReturnValueOnce(['operator']); // roles

    const context = createMockContext({ role: 'manager' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny viewer access to admin endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)    // isPublic
      .mockReturnValueOnce(['admin']); // roles

    const context = createMockContext({ role: 'viewer' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should deny operator access to manager endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)      // isPublic
      .mockReturnValueOnce(['manager']); // roles

    const context = createMockContext({ role: 'operator' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw when user has no role', () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)     // isPublic
      .mockReturnValueOnce(['viewer']); // roles

    const context = createMockContext({});
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow access when user role matches exactly', () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)       // isPublic
      .mockReturnValueOnce(['operator']); // roles

    const context = createMockContext({ role: 'operator' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should use minimum required level when multiple roles specified', () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)                // isPublic
      .mockReturnValueOnce(['admin', 'manager']); // roles - min is manager (3)

    const context = createMockContext({ role: 'manager' });
    expect(guard.canActivate(context)).toBe(true);
  });
});
