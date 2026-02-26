import { Module } from '@nestjs/common';
import { ForecastController } from './forecast.controller';
import { ForecastService } from './forecast.service';
import { ForecastRepository } from './forecast.repository';
import { DriftDetectionService } from './drift-detection.service';
import { ForecastOverrideService } from './forecast-override.service';

@Module({
  controllers: [ForecastController],
  providers: [ForecastService, ForecastRepository, DriftDetectionService, ForecastOverrideService],
  exports: [ForecastService, DriftDetectionService, ForecastOverrideService],
})
export class ForecastModule {}
