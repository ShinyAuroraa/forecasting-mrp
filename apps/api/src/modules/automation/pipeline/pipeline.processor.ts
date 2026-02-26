import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { ConflictException, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { PipelineService } from './pipeline.service';

interface PipelineJobData {
  readonly executionId?: string;
  readonly trigger: 'manual' | 'scheduled';
}

/**
 * PipelineProcessor — BullMQ worker for daily pipeline jobs.
 *
 * Handles both manual triggers (executionId present) and
 * scheduled repeatable jobs (creates execution then runs).
 *
 * @see Story 4.6 — AC-9, AC-16
 */
@Processor('daily-pipeline')
export class PipelineProcessor extends WorkerHost {
  private readonly logger = new Logger(PipelineProcessor.name);

  constructor(private readonly pipelineService: PipelineService) {
    super();
  }

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { executionId, trigger } = job.data;

    this.logger.log(`Processing daily pipeline job (trigger=${trigger}, executionId=${executionId ?? 'new'})`);

    if (executionId) {
      // Manual trigger — execution already created
      await this.pipelineService.executePipeline(executionId);
    } else {
      // Scheduled repeatable job — create execution then run
      try {
        const execution = await this.pipelineService.triggerPipeline();
        await this.pipelineService.executePipeline(execution.id);
      } catch (error) {
        if (error instanceof ConflictException) {
          // Another pipeline is already running — expected for repeatable jobs
          this.logger.warn(`Skipping scheduled pipeline: ${(error as Error).message}`);
          return;
        }
        throw error;
      }
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PipelineJobData>, error: Error): void {
    this.logger.error(
      `Daily pipeline job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }
}
