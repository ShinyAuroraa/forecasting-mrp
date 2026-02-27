import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginatedResponse } from '../../common/dto/paginated-response.dto';

export interface LogActivityDto {
  usuarioId?: string;
  tipo: string;
  recurso?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface ActivitySummary {
  totalEvents: number;
  byType: { tipo: string; count: number }[];
  recentDays: { date: string; count: number }[];
}

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * AC-6: Record a user activity event.
   */
  async log(dto: LogActivityDto) {
    return this.prisma.atividadeUsuario.create({
      data: {
        usuarioId: dto.usuarioId ?? null,
        tipo: dto.tipo as any,
        recurso: dto.recurso ?? null,
        metadata: dto.metadata ?? null,
        ipAddress: dto.ipAddress ?? null,
        userAgent: dto.userAgent ?? null,
      },
    });
  }

  /**
   * AC-7: Get paginated activity for a user.
   */
  async getByUser(usuarioId: string, page = 1, limit = 50) {
    const where = { usuarioId };

    const [data, total] = await Promise.all([
      this.prisma.atividadeUsuario.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.atividadeUsuario.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * AC-10: Get all activity logs with filters.
   */
  async findAll(filters: {
    usuarioId?: string;
    tipo?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const { usuarioId, tipo, dateFrom, dateTo, page = 1, limit = 50 } = filters;
    const where: Record<string, unknown> = {};

    if (usuarioId) where.usuarioId = usuarioId;
    if (tipo) where.tipo = tipo;

    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.atividadeUsuario.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          usuario: { select: { id: true, nome: true, email: true } },
        },
      }),
      this.prisma.atividadeUsuario.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * AC-8: Aggregated activity summary.
   */
  async getSummary(days = 30): Promise<ActivitySummary> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [totalEvents, byType, recentDays] = await Promise.all([
      this.prisma.atividadeUsuario.count({
        where: { createdAt: { gte: since } },
      }),
      this.prisma.atividadeUsuario.groupBy({
        by: ['tipo'],
        where: { createdAt: { gte: since } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      this.prisma.$queryRaw`
        SELECT
          DATE(created_at) AS date,
          COUNT(*)::int AS count
        FROM atividade_usuario
        WHERE created_at >= ${since}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `,
    ]);

    return {
      totalEvents,
      byType: byType.map((r: any) => ({ tipo: r.tipo, count: r._count.id })),
      recentDays: (recentDays as any[]).map((r) => ({
        date: r.date.toISOString().split('T')[0],
        count: r.count,
      })),
    };
  }
}
