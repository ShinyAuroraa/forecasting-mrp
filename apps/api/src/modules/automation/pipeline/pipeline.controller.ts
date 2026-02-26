import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  Sse,
  HttpCode,
  HttpStatus,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';

import { Roles } from '../../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../../common/pipes/uuid-validation.pipe';
import { PipelineService } from './pipeline.service';
import { FilterPipelineDto } from './dto/filter-pipeline.dto';

/**
 * PipelineController — REST endpoints for the Daily Automated Pipeline.
 *
 * @see Story 4.6 — AC-18 through AC-22
 */
@Controller('automation/pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  /**
   * AC-20: Manually trigger the daily pipeline.
   */
  @Post('trigger')
  @Roles('operator')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerPipeline(@Req() req: any) {
    const userId = req?.user?.sub ?? 'unknown';
    return this.pipelineService.triggerPipeline(userId);
  }

  /**
   * AC-21: Get current pipeline execution status.
   */
  @Get('status')
  @Roles('viewer')
  async getStatus() {
    return this.pipelineService.getStatus();
  }

  /**
   * AC-22: List past pipeline executions (paginated).
   */
  @Get('history')
  @Roles('viewer')
  async getHistory(@Query() filters: FilterPipelineDto) {
    return this.pipelineService.findAll(filters);
  }

  /**
   * Get execution details with per-step status.
   */
  @Get(':id')
  @Roles('viewer')
  async findById(@Param('id', UuidValidationPipe) id: string) {
    return this.pipelineService.findById(id);
  }

  /**
   * AC-19: Real-time pipeline progress via SSE (Server-Sent Events).
   *
   * Client connects to this endpoint and receives progress events
   * as each pipeline step starts/completes/fails.
   */
  @Sse(':id/progress')
  @Roles('viewer')
  progress(@Param('id', UuidValidationPipe) executionId: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const unsubProgress = this.pipelineService.onProgress(executionId, (event) => {
        subscriber.next({ data: event } as MessageEvent);
      });

      const unsubComplete = this.pipelineService.onComplete(executionId, () => {
        subscriber.complete();
      });

      return () => {
        unsubProgress();
        unsubComplete();
      };
    });
  }
}
