import { TransformInterceptor } from './transform.interceptor';
import { of } from 'rxjs';
import { lastValueFrom } from 'rxjs';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  const mockContext = {} as any;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('should wrap plain object in data envelope', async () => {
    const handler = { handle: () => of({ id: '1', nome: 'Test' }) };

    const result = await lastValueFrom(
      interceptor.intercept(mockContext, handler),
    );

    expect(result).toEqual({ data: { id: '1', nome: 'Test' } });
  });

  it('should wrap array in data envelope', async () => {
    const handler = { handle: () => of([1, 2, 3]) };

    const result = await lastValueFrom(
      interceptor.intercept(mockContext, handler),
    );

    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it('should wrap string in data envelope', async () => {
    const handler = { handle: () => of('hello') };

    const result = await lastValueFrom(
      interceptor.intercept(mockContext, handler),
    );

    expect(result).toEqual({ data: 'hello' });
  });

  it('should wrap null in data envelope', async () => {
    const handler = { handle: () => of(null) };

    const result = await lastValueFrom(
      interceptor.intercept(mockContext, handler),
    );

    expect(result).toEqual({ data: null });
  });

  it('should NOT double-wrap paginated responses with data+meta', async () => {
    const paginated = {
      data: [{ id: '1' }],
      meta: { total: 1, page: 1, limit: 50, totalPages: 1, hasNext: false, hasPrev: false },
    };
    const handler = { handle: () => of(paginated) };

    const result = await lastValueFrom(
      interceptor.intercept(mockContext, handler),
    );

    expect(result).toEqual(paginated);
    expect(result).not.toHaveProperty('data.data');
  });
});
