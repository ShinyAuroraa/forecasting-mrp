import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ExceptionResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse() as
      | string
      | ExceptionResponse;

    const errorBody = {
      statusCode,
      error: typeof exceptionResponse === 'string'
        ? exceptionResponse
        : exceptionResponse.error ?? exception.name,
      message: typeof exceptionResponse === 'string'
        ? exceptionResponse
        : Array.isArray(exceptionResponse.message)
          ? exceptionResponse.message.join('; ')
          : exceptionResponse.message ?? exception.message,
      details: typeof exceptionResponse === 'object'
        ? this.extractDetails(exceptionResponse)
        : null,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(errorBody);
  }

  private extractDetails(
    response: ExceptionResponse,
  ): Record<string, unknown> | null {
    const { message: _m, error: _e, statusCode: _s, ...rest } = response as Record<string, unknown>;
    return Object.keys(rest).length > 0 ? rest : null;
  }
}
