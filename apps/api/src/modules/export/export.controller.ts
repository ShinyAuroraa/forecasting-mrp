import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  Res,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Response, Request } from 'express';
import { ExportService } from './export.service';
import { RequestExportDto } from './dto/request-export.dto';
import { EXPORT_CONTENT_TYPES, EXPORT_TYPE_LABELS, type ExportFormat } from './export.types';

/**
 * ExportController — endpoints for generating and downloading exports.
 *
 * @see Story 4.10 — AC-14 to AC-17
 */
@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  /** AC-14: POST /export/excel — generate Excel export */
  @Post('excel')
  @Roles('viewer')
  async exportExcel(
    @Body() dto: RequestExportDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.handleExport(dto, 'xlsx', req, res);
  }

  /** AC-15: POST /export/pdf — generate PDF export */
  @Post('pdf')
  @Roles('viewer')
  async exportPdf(
    @Body() dto: RequestExportDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.handleExport(dto, 'pdf', req, res);
  }

  /** AC-16: GET /export/:jobId/download — download generated file */
  @Get(':jobId/download')
  @Roles('viewer')
  async download(
    @Param('jobId') jobId: string,
    @Res() res: Response,
  ) {
    // CRITICAL-2: Validate jobId to prevent path traversal
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(jobId)) {
      throw new BadRequestException('Invalid job ID format');
    }

    const { buffer, fileName, format } = await this.exportService.getDownloadFile(jobId);

    res.setHeader('Content-Type', EXPORT_CONTENT_TYPES[format]);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(buffer);
  }

  /** AC-17: GET /export/history — list recent exports */
  @Get('history')
  @Roles('viewer')
  async history(@Query('limit') limit?: string, @Req() req: Request) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 20, 100) : 20;
    const userId = (req as any).user?.sub ?? 'anonymous';
    return this.exportService.getHistory(userId, parsedLimit);
  }

  // ── Internal ──────────────────────────────────────────

  private async handleExport(
    dto: RequestExportDto,
    format: ExportFormat,
    req: Request,
    res: Response,
  ) {
    const userId = (req as any).user?.sub ?? 'anonymous';
    const filters = dto.filters ?? {};

    const result = await this.exportService.requestExport(dto.type, format, filters, userId);

    if (result.sync) {
      // Small export — return file directly
      const label = EXPORT_TYPE_LABELS[dto.type] ?? dto.type;
      const ext = format === 'xlsx' ? 'xlsx' : 'pdf';
      const fileName = `${label.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.${ext}`;

      res.setHeader('Content-Type', EXPORT_CONTENT_TYPES[format]);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      return res.send(result.buffer);
    }

    // Large export — return job ID for async download
    return res.status(202).json({
      jobId: result.jobId,
      message: 'Export em processamento. Use GET /export/{jobId}/download quando pronto.',
      downloadUrl: `/export/${result.jobId}/download`,
    });
  }
}
