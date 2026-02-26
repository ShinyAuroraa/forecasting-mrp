import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { LeadTimeTrackingService } from './lead-time-tracking.service';
import { RecordLeadTimeDto } from './dto/record-lead-time.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../../common/pipes/uuid-validation.pipe';

@Controller('lead-times')
export class LeadTimeController {
  constructor(
    private readonly leadTimeService: LeadTimeTrackingService,
  ) {}

  @Post()
  @Roles('operator')
  record(@Body() dto: RecordLeadTimeDto) {
    return this.leadTimeService.record(dto);
  }

  @Get('stats/:produtoId')
  @Roles('viewer')
  getStats(@Param('produtoId', UuidValidationPipe) produtoId: string) {
    return this.leadTimeService.getSigmaLt(produtoId);
  }

  @Get(':produtoFornecedorId')
  @Roles('viewer')
  getHistory(
    @Param('produtoFornecedorId', UuidValidationPipe) produtoFornecedorId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const parsedLimit = Math.min(200, Math.max(1, parseInt(limit ?? '50', 10) || 50));
    return this.leadTimeService.getHistory(produtoFornecedorId, parsedPage, parsedLimit);
  }
}
