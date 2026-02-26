import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Query,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';

import { Roles } from '../../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../../common/pipes/uuid-validation.pipe';
import { CycleService } from './cycle.service';
import { TriggerCycleDto } from './dto/trigger-cycle.dto';
import { FilterCyclesDto } from './dto/filter-cycles.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

/**
 * CycleController — REST endpoints for cycle management
 *
 * @see Story 4.5 — AC-9, AC-10, AC-11, AC-14
 */
@Controller('automation/cycles')
export class CycleController {
  constructor(private readonly cycleService: CycleService) {}

  /**
   * List cycle executions with filters and pagination.
   * @see AC-9
   */
  @Get()
  @Roles('viewer')
  async findAll(@Query() filters: FilterCyclesDto) {
    return this.cycleService.findAll(filters);
  }

  /**
   * Get schedule info for all cycle types.
   * @see AC-14
   */
  @Get('schedule')
  @Roles('viewer')
  async getScheduleInfo() {
    return this.cycleService.getScheduleInfo();
  }

  /**
   * Get schedule configuration (cron expressions).
   * @see AC-5
   */
  @Get('schedule/config')
  @Roles('operator')
  async getScheduleConfig() {
    return this.cycleService.getScheduleConfig();
  }

  /**
   * Update schedule configuration (cron expressions).
   * @see AC-5, AC-6
   */
  @Put('schedule/config')
  @Roles('admin')
  async saveScheduleConfig(@Body() dto: UpdateScheduleDto) {
    return this.cycleService.saveScheduleConfig(dto);
  }

  /**
   * Manually trigger a specific cycle type.
   * @see AC-10
   */
  @Post('trigger')
  @Roles('operator')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerCycle(@Body() dto: TriggerCycleDto, @Req() req: Request) {
    const userId = (req as any).user?.sub ?? 'unknown';
    return this.cycleService.triggerCycle(dto.type, userId);
  }

  /**
   * Get execution details with per-step status.
   * @see AC-11
   */
  @Get(':id')
  @Roles('viewer')
  async findById(@Param('id', UuidValidationPipe) id: string) {
    return this.cycleService.findById(id);
  }
}
