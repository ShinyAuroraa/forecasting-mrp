import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable, Subject, finalize } from 'rxjs';
import { Roles } from '../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../common/pipes/uuid-validation.pipe';
import { NotificacaoService } from './notificacao.service';
import { AlertQueryDto } from './dto/alert-query.dto';
import type { Notificacao } from '@prisma/client';
import type { Request } from 'express';

/**
 * Notification Controller
 *
 * REST endpoints for alert listing, acknowledgment, summary, and SSE real-time stream.
 *
 * @see Story 4.4 — AC-11, AC-12, AC-14, AC-15, AC-16
 */
@Controller('alerts')
export class NotificacaoController {
  constructor(private readonly notificacaoService: NotificacaoService) {}

  /**
   * GET /alerts — list alerts with filters.
   * @see AC-14
   */
  @Get()
  @Roles('viewer')
  async findAll(@Query() query: AlertQueryDto) {
    return this.notificacaoService.findAll(query);
  }

  /**
   * GET /alerts/summary — count by type and severity.
   * @see AC-16
   */
  @Get('summary')
  @Roles('viewer')
  async getSummary() {
    return this.notificacaoService.getSummary();
  }

  /**
   * PATCH /alerts/:id/acknowledge — mark alert as acknowledged.
   * Extracts userId from JWT payload set by AuthGuard.
   * @see AC-15
   */
  @Patch(':id/acknowledge')
  @Roles('operator')
  async acknowledge(
    @Param('id', UuidValidationPipe) id: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.sub ?? 'unknown';
    return this.notificacaoService.acknowledge(id, userId);
  }

  /**
   * GET /alerts/stream — SSE endpoint for real-time alerts.
   * @see AC-11, AC-12
   */
  @Sse('stream')
  @Roles('viewer')
  stream(): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();

    const unsubscribe = this.notificacaoService.onNewAlert(
      (alert: Notificacao) => {
        subject.next({
          data: JSON.stringify(alert),
          type: 'alert',
        } as MessageEvent);
      },
    );

    return subject.asObservable().pipe(
      finalize(() => {
        unsubscribe();
        subject.complete();
      }),
    );
  }
}
