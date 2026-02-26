import { PrismaExceptionFilter } from './prisma-exception.filter';
import { Prisma } from '../../generated/prisma/client';

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;

  const mockJson = jest.fn();
  const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
  const mockResponse = { status: mockStatus };
  const mockRequest = { url: '/api/v1/produtos' };
  const mockHost = {
    switchToHttp: () => ({
      getResponse: () => mockResponse,
      getRequest: () => mockRequest,
    }),
  } as any;

  function createPrismaError(
    code: string,
    meta?: Record<string, unknown>,
  ): Prisma.PrismaClientKnownRequestError {
    const error = new Prisma.PrismaClientKnownRequestError(
      `Prisma error ${code}`,
      { code, clientVersion: '7.4.1', meta },
    );
    return error;
  }

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    jest.clearAllMocks();
  });

  it('should map P2002 to 409 Conflict', () => {
    const error = createPrismaError('P2002', {
      target: ['codigo'],
    });

    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(409);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        error: 'Conflict',
        message: expect.stringContaining('codigo'),
        path: '/api/v1/produtos',
      }),
    );
  });

  it('should map P2025 to 404 Not Found', () => {
    const error = createPrismaError('P2025', {
      cause: 'Record to update not found.',
    });

    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        error: 'Not Found',
        message: 'Record to update not found.',
      }),
    );
  });

  it('should map P2003 to 409 Foreign Key Constraint', () => {
    const error = createPrismaError('P2003', {
      field_name: 'categoria_id',
    });

    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(409);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        error: 'Foreign Key Constraint',
        message: expect.stringContaining('categoria_id'),
      }),
    );
  });

  it('should map unknown Prisma code to 500', () => {
    const error = createPrismaError('P9999');

    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'Internal Server Error',
      }),
    );
  });

  it('should include details with code and meta', () => {
    const error = createPrismaError('P2002', { target: ['email'] });

    filter.catch(error, mockHost);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          code: 'P2002',
          meta: { target: ['email'] },
        }),
      }),
    );
  });
});
