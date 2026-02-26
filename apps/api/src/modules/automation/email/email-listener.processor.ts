import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailListenerService } from './email-listener.service';

const MAX_ATTEMPTS = 4;

/**
 * BullMQ Processor for Email Listener
 *
 * Runs as a repeatable job (default: 06:00 daily).
 * Retry: 4 attempts at 30-minute intervals.
 * After 4 failures → dead letter queue + admin alert log.
 *
 * @see Story 4.3 — AC-4, AC-5
 */
@Processor('email-listener')
export class EmailListenerProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailListenerProcessor.name);

  constructor(private readonly emailService: EmailListenerService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing email listener job #${job.id}, attempt ${job.attemptsMade + 1}`);

    try {
      const result = await this.emailService.processEmails();

      this.logger.log(
        `Email listener completed: ${result.emailsFound} emails, ${result.attachmentsProcessed} attachments, ${result.rowsIngested} rows`,
      );

      if (result.errors.length > 0) {
        this.logger.warn(`Email listener had ${result.errors.length} errors: ${result.errors.join('; ')}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Email listener failed: ${message}`);
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    const attempts = job.attemptsMade;
    if (attempts >= MAX_ATTEMPTS) {
      this.logger.error(
        `[ADMIN ALERT] Email listener job #${job.id} exhausted all ${MAX_ATTEMPTS} attempts. ` +
        `Last error: ${error.message}. Job moved to dead-letter queue. Manual intervention required.`,
      );
    } else {
      this.logger.warn(
        `Email listener job #${job.id} failed (attempt ${attempts}/${MAX_ATTEMPTS}): ${error.message}. ` +
        `Will retry in 30 minutes.`,
      );
    }
  }
}
