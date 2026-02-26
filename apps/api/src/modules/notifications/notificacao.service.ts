import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateAlertDto, AlertSummary, AlertType, AlertSeverity } from './notification.types';
import type { AlertQueryDto } from './dto/alert-query.dto';
import type { Notificacao } from '@prisma/client';

type AlertCallback = (alert: Notificacao) => void;

const ALERT_TYPES: AlertType[] = [
  'STOCKOUT', 'URGENT_PURCHASE', 'CAPACITY_OVERLOAD',
  'FORECAST_DEVIATION', 'STORAGE_FULL', 'PIPELINE_FAILURE',
];

const ALERT_SEVERITIES: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

/**
 * Centralized Notification Service
 *
 * Creates, persists, queries, and acknowledges alerts.
 * Publishes new alerts via in-memory pub/sub for SSE delivery.
 *
 * @see Story 4.4 — AC-1, AC-14, AC-15, AC-16
 */
@Injectable()
export class NotificacaoService {
  private readonly logger = new Logger(NotificacaoService.name);
  private readonly subscribers = new Set<AlertCallback>();

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAlertDto): Promise<Notificacao> {
    const alert = await this.prisma.notificacao.create({
      data: {
        tipo: dto.tipo,
        severidade: dto.severidade,
        titulo: dto.titulo,
        mensagem: dto.mensagem,
        entityId: dto.entityId,
        entityType: dto.entityType,
        metadata: (dto.metadata ?? {}) as any,
      },
    });

    this.logger.log(
      `Alert created: [${alert.severidade}] ${alert.tipo} — ${alert.titulo}`,
    );

    for (const subscriber of this.subscribers) {
      try { subscriber(alert); } catch { /* ignore subscriber errors */ }
    }

    return alert;
  }

  onNewAlert(callback: AlertCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  async findAll(query: AlertQueryDto): Promise<{ data: Notificacao[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (query.tipo) where.tipo = query.tipo;
    if (query.severidade) where.severidade = query.severidade;
    if (query.acknowledged === true) where.acknowledgedAt = { not: null };
    if (query.acknowledged === false) where.acknowledgedAt = null;
    if (query.since || query.until) {
      const createdAt: Record<string, Date> = {};
      if (query.since) createdAt.gte = new Date(query.since);
      if (query.until) createdAt.lte = new Date(query.until);
      where.createdAt = createdAt;
    }

    const [data, total] = await Promise.all([
      this.prisma.notificacao.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
      }),
      this.prisma.notificacao.count({ where }),
    ]);

    return { data, total };
  }

  async acknowledge(id: string, userId: string): Promise<Notificacao> {
    const existing = await this.prisma.notificacao.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Alert ${id} not found`);
    }

    return this.prisma.notificacao.update({
      where: { id },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      },
    });
  }

  async getSummary(): Promise<AlertSummary> {
    const unacknowledged = await this.prisma.notificacao.findMany({
      where: { acknowledgedAt: null },
      select: { tipo: true, severidade: true },
    });

    const byType = Object.fromEntries(
      ALERT_TYPES.map((t) => [t, 0]),
    ) as Record<AlertType, number>;

    const bySeverity = Object.fromEntries(
      ALERT_SEVERITIES.map((s) => [s, 0]),
    ) as Record<AlertSeverity, number>;

    for (const alert of unacknowledged) {
      byType[alert.tipo as AlertType] = (byType[alert.tipo as AlertType] ?? 0) + 1;
      bySeverity[alert.severidade as AlertSeverity] = (bySeverity[alert.severidade as AlertSeverity] ?? 0) + 1;
    }

    return {
      byType,
      bySeverity,
      totalUnacknowledged: unacknowledged.length,
    };
  }
}
