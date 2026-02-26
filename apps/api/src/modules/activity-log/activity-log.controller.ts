import { Controller, Get, Query } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('activity-log')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get()
  @Roles('viewer')
  findAll(
    @Query('usuarioId') usuarioId?: string,
    @Query('tipo') tipo?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const parsedLimit = Math.min(200, Math.max(1, parseInt(limit ?? '50', 10) || 50));
    return this.activityLogService.findAll({
      usuarioId,
      tipo,
      dateFrom,
      dateTo,
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Get('summary')
  @Roles('admin')
  getSummary(@Query('days') days?: string) {
    const parsedDays = parseInt(days ?? '30', 10);
    const safeDays = Number.isFinite(parsedDays) && parsedDays > 0
      ? Math.min(parsedDays, 365)
      : 30;
    return this.activityLogService.getSummary(safeDays);
  }
}
