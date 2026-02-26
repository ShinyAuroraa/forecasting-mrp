import { Module } from '@nestjs/common';
import { NotificacaoService } from './notificacao.service';
import { NotificacaoController } from './notificacao.controller';
import { AlertDetectorService } from './detectors/alert-detector.service';

/**
 * NotificationsModule
 *
 * Centralized alert system: CRUD, detection rules, real-time SSE delivery.
 * Note: ScheduleModule.forRoot() must be imported once at AppModule level.
 *
 * @see Story 4.4 — Centralized Alert System
 */
@Module({
  controllers: [NotificacaoController],
  providers: [NotificacaoService, AlertDetectorService],
  exports: [NotificacaoService, AlertDetectorService],
})
export class NotificationsModule {}
