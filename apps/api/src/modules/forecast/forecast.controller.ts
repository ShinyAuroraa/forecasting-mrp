import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ForecastService } from './forecast.service';
import { DriftDetectionService } from './drift-detection.service';
import { ForecastOverrideService } from './forecast-override.service';
import { ExecuteForecastDto } from './dto/execute-forecast.dto';
import { FilterExecutionDto } from './dto/filter-execution.dto';
import { FilterMetricsDto } from './dto/filter-metrics.dto';
import { FilterModelsDto } from './dto/filter-models.dto';
import { ChampionQueryDto } from './dto/champion-query.dto';
import { DriftCheckQueryDto } from './dto/drift-check.dto';
import { CreateOverrideDto } from './dto/create-override.dto';
import { FilterOverridesDto } from './dto/filter-overrides.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../common/pipes/uuid-validation.pipe';

@Controller('forecast')
export class ForecastController {
  constructor(
    private readonly forecastService: ForecastService,
    private readonly driftDetectionService: DriftDetectionService,
    private readonly overrideService: ForecastOverrideService,
  ) {}

  @Post('execute')
  @Roles('operator')
  @HttpCode(HttpStatus.ACCEPTED)
  execute(@Body() dto: ExecuteForecastDto) {
    return this.forecastService.triggerExecution(dto);
  }

  @Get('executions')
  @Roles('viewer')
  findAllExecutions(@Query() filters: FilterExecutionDto) {
    return this.forecastService.findAllExecutions(filters);
  }

  @Get('executions/:id')
  @Roles('viewer')
  findExecutionById(@Param('id', UuidValidationPipe) id: string) {
    return this.forecastService.findExecutionById(id);
  }

  @Get('metrics')
  @Roles('viewer')
  findMetrics(@Query() filters: FilterMetricsDto) {
    return this.forecastService.findMetrics(filters);
  }

  @Get('models')
  @Roles('viewer')
  findModels(@Query() filters: FilterModelsDto) {
    return this.forecastService.findModels(filters);
  }

  @Get('champion')
  @Roles('viewer')
  findCurrentChampion(@Query() query: ChampionQueryDto) {
    return this.forecastService.findCurrentChampion(query.tipoModelo);
  }

  @Get('champion/history')
  @Roles('viewer')
  findChampionHistory(@Query() query: ChampionQueryDto) {
    return this.forecastService.findChampionHistory(query.tipoModelo);
  }

  @Get('drift-status')
  @Roles('viewer')
  getDriftStatus() {
    return this.driftDetectionService.checkAllModels();
  }

  @Get('drift-status/:tipoModelo')
  @Roles('viewer')
  getDriftStatusByModel(@Param('tipoModelo') tipoModelo: string) {
    return this.driftDetectionService.checkDrift(tipoModelo);
  }

  @Post('drift-check')
  @Roles('operator')
  @HttpCode(HttpStatus.OK)
  triggerDriftCheck(@Body() dto: DriftCheckQueryDto) {
    if (dto.tipoModelo) {
      return this.driftDetectionService.checkDrift(dto.tipoModelo);
    }
    return this.driftDetectionService.checkAllModels();
  }

  // ─── Forecast Overrides (Story 5.5 — FR-068) ───

  @Post('overrides')
  @Roles('operator')
  @HttpCode(HttpStatus.CREATED)
  createOverride(@Body() dto: CreateOverrideDto, @Req() req: { user?: { id?: string } }) {
    return this.overrideService.create(dto, req.user?.id);
  }

  @Get('overrides')
  @Roles('viewer')
  findOverrides(@Query() filters: FilterOverridesDto) {
    return this.overrideService.findAll(filters);
  }

  @Get('overrides/:id')
  @Roles('viewer')
  findOverrideById(@Param('id', UuidValidationPipe) id: string) {
    return this.overrideService.findById(id);
  }

  @Post('overrides/:id/revert')
  @Roles('operator')
  @HttpCode(HttpStatus.CREATED)
  revertOverride(@Param('id', UuidValidationPipe) id: string, @Req() req: { user?: { id?: string } }) {
    return this.overrideService.revert(id, req.user?.id);
  }
}
