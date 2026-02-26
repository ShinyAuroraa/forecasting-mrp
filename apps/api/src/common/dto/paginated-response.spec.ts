import { buildPaginatedResponse } from './paginated-response.dto';

describe('buildPaginatedResponse', () => {
  it('should build correct pagination meta for first page', () => {
    const result = buildPaginatedResponse(['a', 'b'], 100, 1, 50);

    expect(result).toEqual({
      data: ['a', 'b'],
      meta: {
        total: 100,
        page: 1,
        limit: 50,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      },
    });
  });

  it('should build correct pagination meta for last page', () => {
    const result = buildPaginatedResponse(['z'], 51, 2, 50);

    expect(result).toEqual({
      data: ['z'],
      meta: {
        total: 51,
        page: 2,
        limit: 50,
        totalPages: 2,
        hasNext: false,
        hasPrev: true,
      },
    });
  });

  it('should handle single-page result', () => {
    const result = buildPaginatedResponse([1, 2, 3], 3, 1, 50);

    expect(result.meta).toEqual(
      expect.objectContaining({
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      }),
    );
  });

  it('should handle empty result', () => {
    const result = buildPaginatedResponse([], 0, 1, 50);

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
    expect(result.meta.totalPages).toBe(0);
  });

  it('should handle middle page', () => {
    const result = buildPaginatedResponse(['x'], 150, 2, 50);

    expect(result.meta.hasNext).toBe(true);
    expect(result.meta.hasPrev).toBe(true);
    expect(result.meta.totalPages).toBe(3);
  });
});
