import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface WrappedResponse<T> {
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, WrappedResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<WrappedResponse<T>> {
    return next.handle().pipe(
      map((value) => {
        if (this.isAlreadyWrapped(value)) {
          return value as unknown as WrappedResponse<T>;
        }
        return { data: value };
      }),
    );
  }

  private isAlreadyWrapped(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value !== 'object') return false;
    return 'data' in (value as Record<string, unknown>) &&
      'meta' in (value as Record<string, unknown>);
  }
}
