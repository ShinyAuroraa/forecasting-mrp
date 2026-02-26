import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { ActivityLogService } from './activity-log.service';

/**
 * AC-9: Interceptor that auto-logs specific API actions.
 * Tracks: login, overrides, exports, MRP/forecast executions, config changes.
 */
@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  private static readonly TRACKED_PATTERNS: ReadonlyMap<string, string> = new Map([
    ['POST /auth/login', 'LOGIN'],
    ['POST /auth/logout', 'LOGOUT'],
    ['POST /forecast/overrides', 'OVERRIDE_CREATE'],
    ['POST /forecast/overrides/:id/revert', 'OVERRIDE_REVERT'],
    ['POST /export', 'EXPORT'],
    ['POST /mrp/execute', 'MRP_EXECUTION'],
    ['POST /forecast/execute', 'FORECAST_EXECUTION'],
    ['PATCH /config', 'CONFIG_CHANGE'],
  ]);

  constructor(private readonly activityLogService: ActivityLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, headers } = request;

    const tipo = this.matchRoute(method, url);
    if (!tipo) {
      return next.handle();
    }

    const usuarioId = request.user?.sub ?? request.user?.id ?? null;
    const userAgent = headers['user-agent'] ?? null;

    return next.handle().pipe(
      tap(() => {
        // Fire-and-forget — don't block the response
        this.activityLogService.log({
          usuarioId,
          tipo,
          recurso: `${method} ${url}`,
          metadata: { url, method },
          ipAddress: ip,
          userAgent,
        }).catch(() => {
          // Silently ignore logging failures
        });
      }),
    );
  }

  private matchRoute(method: string, url: string): string | null {
    // Strip global prefix (api/v1, api/v2, etc.) and query params before matching
    const stripped = url.replace(/^\/api\/v\d+/, '').split('?')[0];
    const normalized = `${method} ${stripped}`;

    for (const [pattern, tipo] of ActivityLogInterceptor.TRACKED_PATTERNS) {
      // Simple pattern matching: replace :param with any segment
      const regex = new RegExp(
        '^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$',
      );
      if (regex.test(normalized)) {
        return tipo;
      }
    }

    return null;
  }
}
