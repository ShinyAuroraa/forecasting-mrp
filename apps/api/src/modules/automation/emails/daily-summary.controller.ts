import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { Roles } from '../../auth/decorators/roles.decorator';
import { DailySummaryService } from './daily-summary.service';
import { UpdateEmailConfigDto } from './dto/email-config.dto';
import { FilterEmailDto } from './dto/filter-email.dto';

/**
 * DailySummaryController — REST endpoints for daily summary & briefing emails.
 *
 * @see Story 4.7 — AC-13 through AC-18
 */
@Controller('automation/emails')
export class DailySummaryController {
  constructor(private readonly dailySummaryService: DailySummaryService) {}

  /**
   * AC-13: Manually trigger daily summary email.
   */
  @Post('send-summary')
  @Roles('operator')
  @HttpCode(HttpStatus.ACCEPTED)
  async sendSummary() {
    return this.dailySummaryService.sendSummary();
  }

  /**
   * AC-17: Manually trigger morning briefing email.
   */
  @Post('send-briefing')
  @Roles('operator')
  @HttpCode(HttpStatus.ACCEPTED)
  async sendBriefing() {
    return this.dailySummaryService.sendBriefing();
  }

  /**
   * AC-16: Get current email configuration (SMTP + recipients).
   */
  @Get('config')
  @Roles('operator')
  async getConfig() {
    return this.dailySummaryService.getFullConfig();
  }

  /**
   * AC-15: Update email configuration (SMTP + recipients).
   */
  @Put('config')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async updateConfig(@Body() dto: UpdateEmailConfigDto) {
    await this.dailySummaryService.saveFullConfig({
      smtp: {
        host: dto.host,
        port: dto.port,
        secure: dto.secure,
        user: dto.user,
        pass: dto.pass,
        fromAddress: dto.fromAddress,
        fromName: dto.fromName,
      },
      recipients: {
        summary: dto.summaryRecipients,
        briefing: dto.briefingRecipients,
        cc: dto.cc ?? [],
        bcc: dto.bcc ?? [],
      },
    });
    return { success: true };
  }

  /**
   * AC-18: List sent emails with delivery status (paginated).
   */
  @Get('history')
  @Roles('viewer')
  async getHistory(@Query() filters: FilterEmailDto) {
    return this.dailySummaryService.getHistory(filters);
  }
}
