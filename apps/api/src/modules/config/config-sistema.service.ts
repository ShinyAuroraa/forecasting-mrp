import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Known configuration keys with typed defaults.
 * AC-5: Provides type-safe access to well-known config entries.
 */
export interface SystemConfigDefaults {
  forecast_horizon_weeks: number;
  service_level_default: number;
  lot_sizing_method: 'L4L' | 'EOQ' | 'SILVER_MEAL' | 'WAGNER_WHITIN';
  lot_sizing_foq_default: number;
  lot_sizing_poq_periods: number;
  safety_stock_method: 'STATISTICAL' | 'MONTE_CARLO';
  monte_carlo_iterations: number;
  monte_carlo_seed: number;
  mrp_default_horizon_weeks: number;
  mrp_include_crp: boolean;
  automation_pipeline_enabled: boolean;
  automation_pipeline_cron: string;
  retraining_cycle_days: number;
  drift_detection_window: number;
  drift_warning_threshold: number;
  drift_critical_threshold: number;
  email_daily_summary_enabled: boolean;
  email_daily_summary_cron: string;
}

export const CONFIG_DEFAULTS: Record<string, { valor: unknown; descricao: string }> = {
  forecast_horizon_weeks: { valor: 12, descricao: 'Horizonte de forecast em semanas' },
  service_level_default: { valor: 0.95, descricao: 'Nível de serviço padrão (0-1)' },
  lot_sizing_method: { valor: 'L4L', descricao: 'Método padrão de lote: L4L, EOQ, SILVER_MEAL, WAGNER_WHITIN' },
  lot_sizing_foq_default: { valor: 100, descricao: 'Quantidade fixa de pedido padrão (FOQ)' },
  lot_sizing_poq_periods: { valor: 4, descricao: 'Número de períodos para POQ' },
  safety_stock_method: { valor: 'STATISTICAL', descricao: 'Método de cálculo de estoque de segurança' },
  monte_carlo_iterations: { valor: 10000, descricao: 'Número de iterações Monte Carlo' },
  monte_carlo_seed: { valor: 42, descricao: 'Seed para RNG Monte Carlo (reprodutibilidade)' },
  mrp_default_horizon_weeks: { valor: 12, descricao: 'Horizonte padrão do MRP em semanas' },
  mrp_include_crp: { valor: true, descricao: 'Incluir CRP na execução MRP por padrão' },
  automation_pipeline_enabled: { valor: false, descricao: 'Habilitar pipeline diário automatizado' },
  automation_pipeline_cron: { valor: '0 6 * * 1-5', descricao: 'Cron expression para pipeline diário' },
  retraining_cycle_days: { valor: 30, descricao: 'Ciclo de re-treinamento em dias' },
  drift_detection_window: { valor: 12, descricao: 'Janela de detecção de drift (semanas)' },
  drift_warning_threshold: { valor: 0.15, descricao: 'Threshold MAPE para drift WARNING' },
  drift_critical_threshold: { valor: 0.25, descricao: 'Threshold MAPE para drift DRIFTING' },
  email_daily_summary_enabled: { valor: false, descricao: 'Habilitar email diário de resumo' },
  email_daily_summary_cron: { valor: '0 7 * * 1-5', descricao: 'Cron expression para email diário' },
};

@Injectable()
export class ConfigSistemaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * AC-1: List all configuration entries.
   */
  async getAll() {
    return this.prisma.configSistema.findMany({
      orderBy: { chave: 'asc' },
    });
  }

  /**
   * AC-2: Get a single config entry by key.
   */
  async get(chave: string) {
    const config = await this.prisma.configSistema.findUnique({
      where: { chave },
    });

    if (!config) {
      throw new NotFoundException(`Config key '${chave}' not found`);
    }

    return config;
  }

  /**
   * AC-5: Typed accessor for known config keys.
   * Returns the default value if the key doesn't exist in the database.
   */
  async getTyped<K extends keyof SystemConfigDefaults>(
    chave: K,
  ): Promise<SystemConfigDefaults[K]> {
    const config = await this.prisma.configSistema.findUnique({
      where: { chave },
    });

    if (config) {
      return config.valor as SystemConfigDefaults[K];
    }

    const defaultEntry = CONFIG_DEFAULTS[chave];
    if (defaultEntry) {
      return defaultEntry.valor as SystemConfigDefaults[K];
    }

    throw new NotFoundException(`Config key '${chave}' not found and has no default`);
  }

  /**
   * AC-3: Create or update a config entry.
   */
  async upsert(chave: string, valor: unknown, descricao?: string, updatedBy?: string) {
    return this.prisma.configSistema.upsert({
      where: { chave },
      create: {
        chave,
        valor: valor as any,
        descricao: descricao ?? null,
        updatedBy: updatedBy ?? null,
      },
      update: {
        valor: valor as any,
        descricao: descricao ?? undefined,
        updatedBy: updatedBy ?? undefined,
      },
    });
  }

  /**
   * AC-4: Remove a config entry.
   */
  async delete(chave: string) {
    const exists = await this.prisma.configSistema.findUnique({
      where: { chave },
    });

    if (!exists) {
      throw new NotFoundException(`Config key '${chave}' not found`);
    }

    return this.prisma.configSistema.delete({
      where: { chave },
    });
  }

  /**
   * AC-7: Seed default config entries.
   * Only inserts entries that don't already exist.
   * Uses createMany with skipDuplicates for atomicity and efficiency.
   */
  async seedDefaults(): Promise<{ created: number; skipped: number }> {
    const data = Object.entries(CONFIG_DEFAULTS).map(([chave, entry]) => ({
      chave,
      valor: entry.valor as any,
      descricao: entry.descricao,
    }));

    const result = await this.prisma.configSistema.createMany({
      data,
      skipDuplicates: true,
    });

    return { created: result.count, skipped: data.length - result.count };
  }
}
