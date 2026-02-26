import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

import { PurchasingPanelService } from './purchasing-panel.service';
import {
  PurchasingPanelQueryDto,
  ExportPanelQueryDto,
  EmailSummaryDto,
} from './dto/purchasing-panel-query.dto';
import { Roles } from '../../auth/decorators/roles.decorator';

/**
 * PurchasingPanelController — Purchasing Panel API
 *
 * Endpoints:
 *   - GET  /mrp/purchasing-panel          — Structured panel data (AC-1)
 *   - GET  /mrp/purchasing-panel/export   — Excel download (AC-6)
 *   - POST /mrp/purchasing-panel/email-summary — Send email summary (AC-7)
 *
 * Role hierarchy: viewer < operator < manager < admin
 *
 * @see Story 3.11 — Purchasing Panel
 */
@Controller('mrp/purchasing-panel')
export class PurchasingPanelController {
  constructor(private readonly service: PurchasingPanelService) {}

  /**
   * Get structured purchasing panel data for a given MRP execution.
   *
   * Returns urgent actions, supplier summary, and aggregate totals.
   *
   * @param query - Must include execucaoId (UUID)
   * @returns PurchasingPanelResponse
   */
  @Get()
  @Roles('viewer')
  getPanelData(@Query() query: PurchasingPanelQueryDto) {
    return this.service.getPanelData(query.execucaoId);
  }

  /**
   * Export purchasing panel data as an Excel (.xlsx) file.
   *
   * Streams the file as a download with Content-Disposition header.
   *
   * @param query - Must include execucaoId (UUID), optional format
   * @param res - Express Response for streaming the file
   */
  @Get('export')
  @Roles('viewer')
  async exportExcel(
    @Query() query: ExportPanelQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.service.getExportData(query.execucaoId);
    const filename = `purchasing-panel-${query.execucaoId.slice(0, 8)}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
  }

  /**
   * Send purchasing panel email summary.
   *
   * Currently a placeholder that logs the email content.
   *
   * @param body - Must include execucaoId (UUID)
   * @returns Email send result with recipients list
   */
  @Post('email-summary')
  @Roles('manager')
  @HttpCode(HttpStatus.OK)
  sendEmailSummary(@Body() body: EmailSummaryDto) {
    return this.service.sendEmailSummary(body.execucaoId);
  }
}
