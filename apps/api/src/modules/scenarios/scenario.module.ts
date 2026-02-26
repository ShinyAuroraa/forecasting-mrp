import { Module } from '@nestjs/common';
import { ScenarioController } from './scenario.controller';
import { ScenarioService } from './scenario.service';

/**
 * Scenario Module — What-If Scenario Analysis.
 *
 * @see Story 4.9
 */
@Module({
  controllers: [ScenarioController],
  providers: [ScenarioService],
  exports: [ScenarioService],
})
export class ScenarioModule {}
