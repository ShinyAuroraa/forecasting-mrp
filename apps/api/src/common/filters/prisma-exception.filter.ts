import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { Request, Response } from 'express';

const PRISMA_ERROR_MAP: Record<
  string,
  { status: number; error: string }
> = {
  P2002: { status: HttpStatus.CONFLICT, error: 'Conflict' },
  P2003: { status: HttpStatus.CONFLICT, error: 'Foreign Key Constraint' },
  P2014: { status: HttpStatus.BAD_REQUEST, error: 'Required Relation Violation' },
  P2025: { status: HttpStatus.NOT_FOUND, error: 'Not Found' },
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const mapped = PRISMA_ERROR_MAP[exception.code];
    const statusCode = mapped?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const error = mapped?.error ?? 'Internal Server Error';

    const details = this.buildDetails(exception);

    response.status(statusCode).json({
      statusCode,
      error,
      message: this.buildMessage(exception),
      details,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private buildMessage(
    exception: Prisma.PrismaClientKnownRequestError,
  ): string {
    switch (exception.code) {
      case 'P2002': {
        const target = (exception.meta?.['target'] as string[]) ?? [];
        return `Unique constraint violated on field(s): ${target.join(', ')}`;
      }
      case 'P2003': {
        const field = (exception.meta?.['field_name'] as string) ?? 'unknown';
        return `Foreign key constraint failed on field: ${field}`;
      }
      case 'P2025':
        return (exception.meta?.['cause'] as string) ?? 'Record not found';
      default:
        return exception.message;
    }
  }

  private buildDetails(
    exception: Prisma.PrismaClientKnownRequestError,
  ): Record<string, unknown> {
    return {
      code: exception.code,
      meta: exception.meta ?? null,
    };
  }
}
