import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IngestaoUploadService } from '../ingestao/ingestao-upload.service';
import { MappingTemplateRepository } from '../ingestao/mapping-template.repository';
import {
  ErpConfig,
  ConnectorType,
  RawMovementData,
} from './connectors/erp-connector.interface';
import { ConnectorFactory } from './connectors/connector.factory';

export interface FetchResult {
  readonly connector: ConnectorType;
  readonly recordsFetched: number;
  readonly imported: number;
  readonly updated: number;
  readonly rejected: number;
  readonly errors: ReadonlyArray<{ readonly row: number; readonly field: string; readonly message: string }>;
  readonly usedFallback: boolean;
  readonly templateApplied: string | null;
}

const CONFIG_KEY = 'automacao.erp';

/**
 * Automation Service
 *
 * Manages ERP connector configuration and orchestrates daily data fetching.
 * Supports primary + fallback connector pattern.
 * Integrates with the ingestion pipeline for data processing.
 *
 * @see Story 4.2 — AC-3, AC-4, AC-13, AC-14, AC-15
 */
@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);
  private currentGranularidade: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: IngestaoUploadService,
    private readonly templateRepository: MappingTemplateRepository,
  ) {}

  async getConfig(): Promise<ErpConfig | null> {
    const config = await this.prisma.configSistema.findUnique({
      where: { chave: CONFIG_KEY },
    });

    if (!config) return null;

    return config.valor as unknown as ErpConfig;
  }

  async getConfigMasked(): Promise<ErpConfig | null> {
    const config = await this.getConfig();
    if (!config) return null;
    return this.maskCredentials(config);
  }

  private maskCredentials(config: ErpConfig): ErpConfig {
    const mask = (val?: string) => (val ? '••••••••' : undefined);

    return {
      ...config,
      rest: config.rest
        ? {
            ...config.rest,
            auth: {
              ...config.rest.auth,
              apiKey: mask(config.rest.auth.apiKey),
              token: mask(config.rest.auth.token),
              password: mask(config.rest.auth.password),
            },
          }
        : undefined,
      db: config.db
        ? { ...config.db, connectionString: '••••••••' }
        : undefined,
      sftp: config.sftp
        ? {
            ...config.sftp,
            password: mask(config.sftp.password),
            privateKey: mask(config.sftp.privateKey),
          }
        : undefined,
    };
  }

  async saveConfig(config: ErpConfig): Promise<ErpConfig> {
    await this.prisma.configSistema.upsert({
      where: { chave: CONFIG_KEY },
      create: {
        chave: CONFIG_KEY,
        valor: config as any,
        descricao: 'ERP Connector configuration (type, credentials, fallback)',
      },
      update: {
        valor: config as any,
      },
    });

    return config;
  }

  async testConnection(type?: ConnectorType): Promise<{ success: boolean; error?: string }> {
    const config = await this.getConfig();
    if (!config) {
      throw new NotFoundException('ERP connector configuration not found');
    }

    const connectorType = type ?? config.tipo;

    try {
      const connector = ConnectorFactory.create(config, connectorType);
      const success = await connector.testConnection();
      return { success };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Connection test failed for ${connectorType}: ${message}`);
      return { success: false, error: message };
    }
  }

  async fetchDailyData(date?: Date): Promise<FetchResult> {
    const config = await this.getConfig();
    if (!config) {
      throw new NotFoundException('ERP connector configuration not found');
    }

    const targetDate = date ?? this.getYesterday();
    this.currentGranularidade = config.granularidade;
    let usedFallback = false;
    let activeType: ConnectorType = config.tipo;
    let rawData: RawMovementData[];

    try {
      const primaryConnector = ConnectorFactory.create(config, config.tipo);
      rawData = await primaryConnector.fetchDailyData(targetDate);
    } catch (primaryError) {
      this.logger.warn(
        `Primary connector (${config.tipo}) failed: ${primaryError instanceof Error ? primaryError.message : 'Unknown'}`,
      );

      if (!config.fallback) {
        throw new BadRequestException(
          `Primary connector (${config.tipo}) failed and no fallback configured`,
        );
      }

      try {
        const fallbackConnector = ConnectorFactory.create(config, config.fallback);
        rawData = await fallbackConnector.fetchDailyData(targetDate);
        usedFallback = true;
        activeType = config.fallback;
      } catch (fallbackError) {
        throw new BadRequestException(
          `Both primary (${config.tipo}) and fallback (${config.fallback}) connectors failed`,
        );
      }
    }

    if (rawData.length === 0) {
      return {
        connector: activeType,
        recordsFetched: 0,
        imported: 0,
        updated: 0,
        rejected: 0,
        errors: [],
        usedFallback,
        templateApplied: config.templateId ?? null,
      };
    }

    const result = await this.processRawData(rawData, config.templateId);

    return {
      connector: activeType,
      recordsFetched: rawData.length,
      imported: result.imported,
      updated: result.updated,
      rejected: result.rejected,
      errors: result.errors.map((e) => ({ row: e.row, field: e.field, message: e.message })),
      usedFallback,
      templateApplied: config.templateId ?? null,
    };
  }

  private async processRawData(
    rawData: RawMovementData[],
    templateId?: string,
  ) {
    const csvContent = this.rawDataToCsv(rawData);
    const buffer = Buffer.from(csvContent, 'utf-8');

    const file = {
      buffer,
      mimetype: 'text/csv',
      originalname: 'erp_fetch.csv',
    } as Express.Multer.File;

    const granularidade = this.currentGranularidade ?? 'diario';
    return this.uploadService.processUpload(file, granularidade, templateId);
  }

  private rawDataToCsv(data: RawMovementData[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const lines = [headers.join(',')];

    for (const row of data) {
      const values = headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      });
      lines.push(values.join(','));
    }

    return lines.join('\n');
  }

  private getYesterday(): Date {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
