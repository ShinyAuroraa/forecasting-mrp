import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { IngestaoModule } from '../ingestao/ingestao.module';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { EmailListenerController } from './email/email-listener.controller';
import { EmailListenerService } from './email/email-listener.service';
import { EmailListenerProcessor } from './email/email-listener.processor';
import { PdfOcrService } from './ocr/pdf-ocr.service';
import { CycleController } from './cycles/cycle.controller';
import { CycleService } from './cycles/cycle.service';
import { CycleRepository } from './cycles/cycle.repository';
import { CycleProcessor } from './cycles/cycle.processor';
import { PipelineController } from './pipeline/pipeline.controller';
import { PipelineService } from './pipeline/pipeline.service';
import { PipelineRepository } from './pipeline/pipeline.repository';
import { PipelineProcessor } from './pipeline/pipeline.processor';
import { DailySummaryController } from './emails/daily-summary.controller';
import { DailySummaryService } from './emails/daily-summary.service';
import { EmailSenderService } from './emails/email-sender.service';
import { EmailAggregatorService } from './emails/email-aggregator.service';

@Module({
  imports: [
    IngestaoModule,
    EventEmitterModule.forRoot(),
    BullModule.registerQueue({
      name: 'email-listener',
      defaultJobOptions: {
        attempts: 4,
        backoff: { type: 'fixed', delay: 30 * 60 * 1000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    }),
    BullModule.registerQueue({
      name: 'cycles',
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    }),
    BullModule.registerQueue({
      name: 'daily-pipeline',
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    }),
  ],
  controllers: [AutomationController, EmailListenerController, CycleController, PipelineController, DailySummaryController],
  providers: [
    AutomationService,
    EmailListenerService,
    EmailListenerProcessor,
    PdfOcrService,
    CycleService,
    CycleRepository,
    CycleProcessor,
    PipelineService,
    PipelineRepository,
    PipelineProcessor,
    DailySummaryService,
    EmailSenderService,
    EmailAggregatorService,
  ],
  exports: [AutomationService, EmailListenerService, CycleService, PipelineService, DailySummaryService],
})
export class AutomationModule {}
