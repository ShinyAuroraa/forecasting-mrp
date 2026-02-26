import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DriftCheckResult,
  DriftLog,
  DriftStatus,
  DRIFT_THRESHOLD,
  DRIFT_WARNING_THRESHOLD,
  MAX_MAPE_HISTORY,
  ROLLING_WINDOW_SIZE,
} from './drift-detection.interfaces';

@Injectable()
export class DriftDetectionService {
  private readonly logger = new Logger(DriftDetectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * AC-1: Compute rolling MAPE from last N weekly executions per model type.
   * Returns average MAPE values grouped by model from recent executions.
   */
  async getRecentMapes(
    tipoModelo: string,
    limit = MAX_MAPE_HISTORY,
  ): Promise<number[]> {
    // Get recent executions ordered by date
    const recentMetrics = await (this.prisma as any).forecastMetrica.findMany({
      where: { modelo: tipoModelo },
      orderBy: { createdAt: 'desc' },
      take: limit * 20, // fetch enough rows to cover limit executions
      select: {
        execucaoId: true,
        mape: true,
        createdAt: true,
      },
    });

    if (!recentMetrics?.length) return [];

    // Group by execution, compute avg MAPE per execution with recency tracking
    const byExecution = new Map<string, { mapes: number[]; latestAt: Date }>();
    for (const m of recentMetrics) {
      if (m.mape == null) continue;
      const mape = typeof m.mape === 'number' ? m.mape : Number(m.mape);
      if (Number.isNaN(mape)) continue;

      const existing = byExecution.get(m.execucaoId);
      if (existing) {
        existing.mapes.push(mape);
        if (m.createdAt > existing.latestAt) existing.latestAt = m.createdAt;
      } else {
        byExecution.set(m.execucaoId, { mapes: [mape], latestAt: m.createdAt });
      }
    }

    // Average MAPE per execution, sorted by recency (most recent first)
    const avgMapes = [...byExecution.values()]
      .sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime())
      .map(({ mapes }) => Math.round((mapes.reduce((a, b) => a + b, 0) / mapes.length) * 100) / 100);

    return avgMapes.slice(0, limit);
  }

  /**
   * AC-2/AC-3: Determine drift status based on rolling MAPE trend.
   * Pure function for testability.
   */
  computeDriftStatus(
    recentMapes: readonly number[],
    warningThreshold = DRIFT_WARNING_THRESHOLD,
    driftThreshold = DRIFT_THRESHOLD,
  ): { status: DriftStatus; currentMape: number; rollingAvgMape: number; mapeIncreasePct: number } {
    if (recentMapes.length === 0) {
      return { status: DriftStatus.STABLE, currentMape: 0, rollingAvgMape: 0, mapeIncreasePct: 0 };
    }

    const currentMape = recentMapes[0];

    if (recentMapes.length < 2) {
      return { status: DriftStatus.STABLE, currentMape, rollingAvgMape: currentMape, mapeIncreasePct: 0 };
    }

    // AC-1: Rolling average of the window (excluding most recent)
    const windowSize = Math.min(ROLLING_WINDOW_SIZE, recentMapes.length - 1);
    const olderMapes = recentMapes.slice(1, 1 + windowSize);
    const rollingAvgMape = Math.round(
      (olderMapes.reduce((a, b) => a + b, 0) / olderMapes.length) * 100,
    ) / 100;

    // Percentage increase relative to rolling average
    const mapeIncreasePct = rollingAvgMape > 0
      ? Math.round(((currentMape - rollingAvgMape) / rollingAvgMape) * 10000) / 10000
      : 0;

    // AC-3: Determine status
    let status: DriftStatus;
    if (mapeIncreasePct >= driftThreshold) {
      status = DriftStatus.DRIFTING;
    } else if (mapeIncreasePct >= warningThreshold) {
      status = DriftStatus.WARNING;
    } else {
      status = DriftStatus.STABLE;
    }

    return { status, currentMape, rollingAvgMape, mapeIncreasePct };
  }

  /**
   * AC-4: Run drift check for a model type.
   */
  async checkDrift(tipoModelo: string): Promise<DriftCheckResult> {
    const recentMapes = await this.getRecentMapes(tipoModelo);
    const { status, currentMape, rollingAvgMape, mapeIncreasePct } =
      this.computeDriftStatus(recentMapes);

    const result: DriftCheckResult = {
      tipoModelo,
      status,
      currentMape,
      rollingAvgMape,
      mapeIncreasePct,
      recentMapes: recentMapes.slice(0, MAX_MAPE_HISTORY),
      checkedAt: new Date().toISOString(),
    };

    // AC-5: If drifting, trigger retraining
    let retrainingTriggered = false;
    if (status === DriftStatus.DRIFTING) {
      this.logger.warn(
        `Drift detected for ${tipoModelo}: MAPE increased ${(mapeIncreasePct * 100).toFixed(1)}% ` +
        `(current: ${currentMape}%, rolling avg: ${rollingAvgMape}%). Triggering retraining.`,
      );
      await this.triggerRetraining(tipoModelo);
      retrainingTriggered = true;
    }

    // AC-6: Store drift log
    await this.storeDriftLog(tipoModelo, {
      status,
      currentMape,
      rollingAvgMape,
      mapeIncreasePct,
      recentMapes: recentMapes.slice(0, MAX_MAPE_HISTORY),
      checkedAt: result.checkedAt,
      retrainingTriggered,
    });

    return result;
  }

  /**
   * AC-8: Get drift status for all model types.
   */
  async checkAllModels(): Promise<DriftCheckResult[]> {
    const modelTypes = await this.getDistinctModelTypes();
    const results: DriftCheckResult[] = [];

    for (const tipo of modelTypes) {
      results.push(await this.checkDrift(tipo));
    }

    return results;
  }

  /**
   * AC-5: Trigger retraining by creating a new forecast execution.
   */
  private async triggerRetraining(tipoModelo: string): Promise<void> {
    try {
      await (this.prisma as any).execucaoPlanejamento.create({
        data: {
          tipo: 'FORECAST',
          status: 'PENDENTE',
          gatilho: 'AUTO_INGESTAO',
          parametros: {
            source: 'drift_detection',
            tipoModelo,
            reason: 'automatic_retraining_drift_detected',
          },
        },
      });
      this.logger.log(`Retraining job queued for model ${tipoModelo}`);
    } catch (error) {
      this.logger.error(`Failed to trigger retraining for ${tipoModelo}`, error);
    }
  }

  /**
   * AC-6: Store drift check result in the champion model's metricasTreino.
   */
  private async storeDriftLog(tipoModelo: string, log: DriftLog): Promise<void> {
    try {
      const champion = await (this.prisma as any).forecastModelo.findFirst({
        where: { tipoModelo, isChampion: true },
        orderBy: { createdAt: 'desc' },
      });

      if (champion) {
        const existingMetrics = (champion.metricasTreino as Record<string, unknown>) ?? {};
        await (this.prisma as any).forecastModelo.update({
          where: { id: champion.id },
          data: {
            metricasTreino: {
              ...existingMetrics,
              drift_log: log,
            },
          },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to store drift log for ${tipoModelo}`, error);
    }
  }

  /**
   * Get all distinct model types that have metrics.
   */
  private async getDistinctModelTypes(): Promise<string[]> {
    const models = await (this.prisma as any).forecastModelo.findMany({
      where: { isChampion: true },
      select: { tipoModelo: true },
      distinct: ['tipoModelo'],
    });

    return models?.map((m: { tipoModelo: string }) => m.tipoModelo) ?? [];
  }
}
