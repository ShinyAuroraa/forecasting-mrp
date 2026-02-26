import { Injectable, NotFoundException } from '@nestjs/common';
import { ForecastRepository } from './forecast.repository';
import { ExecuteForecastDto } from './dto/execute-forecast.dto';
import { FilterExecutionDto } from './dto/filter-execution.dto';
import { FilterMetricsDto } from './dto/filter-metrics.dto';
import { FilterModelsDto } from './dto/filter-models.dto';

@Injectable()
export class ForecastService {
  constructor(private readonly repository: ForecastRepository) {}

  async triggerExecution(dto: ExecuteForecastDto) {
    return this.repository.createExecution(dto);
  }

  async findAllExecutions(filters: FilterExecutionDto) {
    return this.repository.findAllExecutions(filters);
  }

  async findExecutionById(id: string) {
    const execution = await this.repository.findExecutionById(id);
    if (!execution) {
      throw new NotFoundException(`Execution with id ${id} not found`);
    }
    return execution;
  }

  async findMetrics(filters: FilterMetricsDto) {
    return this.repository.findMetrics(filters);
  }

  async findModels(filters: FilterModelsDto) {
    return this.repository.findModels(filters);
  }

  async findCurrentChampion(tipoModelo?: string) {
    const champion = await this.repository.findCurrentChampion(tipoModelo);
    if (!champion) {
      throw new NotFoundException(
        `No champion model found${tipoModelo ? ` for type ${tipoModelo}` : ''}`,
      );
    }
    return champion;
  }

  async findChampionHistory(tipoModelo?: string, limit = 10) {
    return this.repository.findChampionHistory(tipoModelo, limit);
  }
}
