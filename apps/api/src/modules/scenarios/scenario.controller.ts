import { Controller, Get, Post, Delete, Param, Body, Req } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../common/pipes/uuid-validation.pipe';
import { ScenarioService } from './scenario.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import type { ScenarioData, ScenarioImpact } from './scenario.types';
import type { Request } from 'express';

/**
 * Scenario Controller — What-If Scenario Analysis endpoints.
 *
 * @see Story 4.9 — AC-10, AC-11, AC-12, AC-13
 */
@Controller('scenarios')
export class ScenarioController {
  constructor(private readonly scenarioService: ScenarioService) {}

  /**
   * GET /scenarios — list saved scenarios.
   * @see AC-10
   */
  @Get()
  @Roles('viewer')
  async list(): Promise<ScenarioData[]> {
    return this.scenarioService.listScenarios();
  }

  /**
   * POST /scenarios — create new scenario with adjustments.
   * @see AC-11
   */
  @Post()
  @Roles('operator')
  async create(@Body() dto: CreateScenarioDto, @Req() req: Request): Promise<ScenarioData> {
    const userId = (req as any).user?.sub ?? undefined;
    return this.scenarioService.createScenario(dto, userId);
  }

  /**
   * GET /scenarios/:id/impact — compute impact analysis.
   * @see AC-12
   */
  @Get(':id/impact')
  @Roles('viewer')
  async getImpact(@Param('id', UuidValidationPipe) id: string): Promise<ScenarioImpact> {
    return this.scenarioService.computeImpact(id);
  }

  /**
   * DELETE /scenarios/:id — delete scenario.
   * @see AC-13
   */
  @Delete(':id')
  @Roles('operator')
  async remove(@Param('id', UuidValidationPipe) id: string): Promise<{ success: boolean }> {
    await this.scenarioService.deleteScenario(id);
    return { success: true };
  }
}
