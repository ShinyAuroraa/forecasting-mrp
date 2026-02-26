import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { AutomationService } from './automation.service';
import {
  UpdateErpConfigDto,
  TestConnectionDto,
  FetchDailyDataDto,
} from './dto/erp-config.dto';

/**
 * Automation Controller
 *
 * Endpoints for ERP connector configuration, testing, and manual fetching.
 *
 * @see Story 4.2 — AC-16, AC-17
 */
@Controller('automation')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get('config')
  @Roles('operator')
  async getConfig() {
    const config = await this.automationService.getConfigMasked();
    if (!config) {
      throw new NotFoundException('ERP connector configuration not found. Please configure a connector first.');
    }
    return config;
  }

  @Put('config')
  @Roles('admin')
  async updateConfig(@Body() dto: UpdateErpConfigDto) {
    return this.automationService.saveConfig(dto);
  }

  @Post('test-connection')
  @Roles('operator')
  async testConnection(@Body() dto: TestConnectionDto) {
    return this.automationService.testConnection(dto.tipo);
  }

  @Post('fetch')
  @Roles('operator')
  async fetchDailyData(@Query() dto: FetchDailyDataDto) {
    const date = dto.date ? new Date(dto.date) : undefined;
    return this.automationService.fetchDailyData(date);
  }
}
