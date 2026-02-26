import { ActivityLogInterceptor } from './activity-log.interceptor';
import { of } from 'rxjs';

describe('ActivityLogInterceptor — AC-9', () => {
  let interceptor: ActivityLogInterceptor;
  let mockLogService: { log: jest.Mock };

  beforeEach(() => {
    mockLogService = {
      log: jest.fn().mockResolvedValue({ id: 'act-1' }),
    };
    interceptor = new ActivityLogInterceptor(mockLogService as any);
  });

  const createContext = (method: string, url: string, user?: { sub: string }) => ({
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        url,
        ip: '127.0.0.1',
        headers: { 'user-agent': 'TestAgent' },
        user: user ?? null,
      }),
    }),
  });

  const callHandler = { handle: () => of({ success: true }) };

  it('should log LOGIN events', (done) => {
    const ctx = createContext('POST', '/auth/login', { sub: 'user-1' });

    interceptor.intercept(ctx as any, callHandler).subscribe(() => {
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: 'user-1',
          tipo: 'LOGIN',
        }),
      );
      done();
    });
  });

  it('should log EXPORT events', (done) => {
    const ctx = createContext('POST', '/export');

    interceptor.intercept(ctx as any, callHandler).subscribe(() => {
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'EXPORT',
        }),
      );
      done();
    });
  });

  it('should log OVERRIDE_CREATE events', (done) => {
    const ctx = createContext('POST', '/forecast/overrides', { sub: 'user-2' });

    interceptor.intercept(ctx as any, callHandler).subscribe(() => {
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'OVERRIDE_CREATE',
          usuarioId: 'user-2',
        }),
      );
      done();
    });
  });

  it('should NOT log untracked routes', (done) => {
    const ctx = createContext('GET', '/produtos');

    interceptor.intercept(ctx as any, callHandler).subscribe(() => {
      expect(mockLogService.log).not.toHaveBeenCalled();
      done();
    });
  });

  it('should handle null user gracefully', (done) => {
    const ctx = createContext('POST', '/auth/login');

    interceptor.intercept(ctx as any, callHandler).subscribe(() => {
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: null,
        }),
      );
      done();
    });
  });

  it('should strip query params before matching', (done) => {
    const ctx = createContext('POST', '/export?format=pdf');

    interceptor.intercept(ctx as any, callHandler).subscribe(() => {
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'EXPORT',
        }),
      );
      done();
    });
  });

  it('should strip /api/v1 prefix before matching', (done) => {
    const ctx = createContext('POST', '/api/v1/auth/login', { sub: 'user-3' });

    interceptor.intercept(ctx as any, callHandler).subscribe(() => {
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'LOGIN',
          usuarioId: 'user-3',
        }),
      );
      done();
    });
  });

  it('should strip /api/v1 prefix with query params', (done) => {
    const ctx = createContext('POST', '/api/v1/export?format=excel');

    interceptor.intercept(ctx as any, callHandler).subscribe(() => {
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'EXPORT',
        }),
      );
      done();
    });
  });
});
