import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { EmailListenerService } from './email-listener.service';
import { UpdateEmailConfigDto } from '../dto/email-config.dto';

/**
 * Email Listener Controller
 *
 * @see Story 4.3 — AC-12, AC-13, AC-14, AC-15
 */
@Controller('automation/email')
export class EmailListenerController {
  constructor(private readonly emailService: EmailListenerService) {}

  @Get('config')
  @Roles('operator')
  async getConfig() {
    const config = await this.emailService.getConfigMasked();
    if (!config) {
      throw new NotFoundException('Email listener configuration not found');
    }
    return config;
  }

  @Put('config')
  @Roles('admin')
  async updateConfig(@Body() dto: UpdateEmailConfigDto) {
    return this.emailService.saveConfig(dto);
  }

  @Post('test-connection')
  @Roles('operator')
  async testConnection() {
    return this.emailService.testConnection();
  }

  @Post('trigger')
  @Roles('operator')
  async triggerManually() {
    return this.emailService.processEmails();
  }

  @Get('logs')
  @Roles('viewer')
  async getLogs(@Query('limit') limit?: string) {
    const parsed = limit ? parseInt(limit, 10) : NaN;
    const parsedLimit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 20;
    return this.emailService.getExecutionLogs(parsedLimit);
  }
}
