import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  const mockJson = jest.fn();
  const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
  const mockResponse = { status: mockStatus };
  const mockRequest = { url: '/api/v1/test' };
  const mockHost = {
    switchToHttp: () => ({
      getResponse: () => mockResponse,
      getRequest: () => mockRequest,
    }),
  } as any;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    jest.clearAllMocks();
  });

  it('should handle string exception response', () => {
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: expect.any(String),
        path: '/api/v1/test',
        timestamp: expect.any(String),
      }),
    );
  });

  it('should handle object exception response with message array', () => {
    const exception = new HttpException(
      {
        statusCode: 400,
        message: ['field must be string', 'field2 is required'],
        error: 'Bad Request',
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
        message: 'field must be string; field2 is required',
      }),
    );
  });

  it('should include details from extra properties', () => {
    const exception = new HttpException(
      {
        statusCode: 409,
        message: 'Conflict',
        error: 'Conflict',
        field: 'codigo',
        value: 'SKU-001',
      },
      HttpStatus.CONFLICT,
    );

    filter.catch(exception, mockHost);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        details: expect.objectContaining({
          field: 'codigo',
          value: 'SKU-001',
        }),
      }),
    );
  });

  it('should return null details when no extra properties', () => {
    const exception = new HttpException(
      { statusCode: 404, message: 'Not Found', error: 'Not Found' },
      HttpStatus.NOT_FOUND,
    );

    filter.catch(exception, mockHost);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ details: null }),
    );
  });
});
