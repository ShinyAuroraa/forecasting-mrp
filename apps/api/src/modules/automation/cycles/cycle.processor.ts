import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { ConflictException, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { CycleService } from './cycle.service';
import type { CycleType } from './cycle.types';

interface CycleJobData {
  readonly executionId?: string;
  readonly cycleType: CycleType;
}

/**
 * CycleProcessor — BullMQ worker for cycle execution.
 *
 * Handles both repeatable scheduled jobs and manual trigger jobs.
 * Repeatable jobs create a new execution; trigger jobs use an existing one.
 *
 * @see Story 4.5 — AC-7
 */
@Processor('cycles')
export class CycleProcessor extends WorkerHost {
  private readonly logger = new Logger(CycleProcessor.name);

  constructor(private readonly cycleService: CycleService) {
    super();
  }

  async process(job: Job<CycleJobData>): Promise<void> {
    const { executionId, cycleType } = job.data;

    if (executionId) {
      // Manual trigger or queued execution — execution already created
      this.logger.log(`Processing cycle job: type=${cycleType}, execution=${executionId}`);
      await this.cycleService.executeCycle(executionId, cycleType);
    } else {
      // Repeatable job — create execution then run.
      // ConflictException is expected when another cycle is already running.
      try {
        this.logger.log(`Repeatable cycle job: type=${cycleType}`);
        const execution = await this.cycleService.triggerCycle(cycleType);
        await this.cycleService.executeCycle(execution.id, cycleType);
      } catch (error) {
        if (error instanceof ConflictException) {
          this.logger.warn(`Skipping repeatable cycle ${cycleType}: ${(error as Error).message}`);
          return;
        }
        throw error;
      }
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CycleJobData>, error: Error): void {
    this.logger.error(
      `Cycle job failed: ${job.name} (type=${job.data.cycleType}, execution=${job.data.executionId ?? 'repeatable'}): ${error.message}`,
    );
  }
}
