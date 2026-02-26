import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface BomVersionSummary {
  versao: number;
  validoDesde: Date | null;
  validoAte: Date | null;
  lineCount: number;
  createdAt: Date;
}

export interface BomVersionLine {
  id: string;
  produtoFilhoId: string;
  produtoFilhoCodigo: string;
  produtoFilhoDescricao: string;
  quantidade: number;
  perdaPercentual: number;
  versao: number;
  validoDesde: Date | null;
  validoAte: Date | null;
}

@Injectable()
export class BomVersionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * AC-3: Create a new BOM version for a parent product.
   * Copies current active lines, sets validoAte on previous version.
   * AC-7: Entire operation is atomic (single transaction).
   */
  async createNewVersion(
    produtoPaiId: string,
    validoDesde: Date = new Date(),
  ) {
    // Validate date
    if (isNaN(validoDesde.getTime())) {
      throw new BadRequestException('validoDesde must be a valid date');
    }

    // AC-7: All reads and writes inside single transaction to prevent race conditions
    const result = await this.prisma.$transaction(async (tx) => {
      // Get current max version for this parent
      const maxVersionResult = await tx.bom.aggregate({
        where: { produtoPaiId },
        _max: { versao: true },
      });

      const currentVersion = maxVersionResult._max.versao ?? 0;
      const newVersion = currentVersion + 1;

      // Get current active lines — when currentVersion is 0, no lines to copy
      const currentLines = currentVersion > 0
        ? await tx.bom.findMany({
            where: {
              produtoPaiId,
              versao: currentVersion,
              ativo: true,
              validoAte: null,
            },
          })
        : [];

      // Close previous version: set validoAte on all active lines
      if (currentVersion > 0) {
        await tx.bom.updateMany({
          where: {
            produtoPaiId,
            versao: currentVersion,
            ativo: true,
            validoAte: null,
          },
          data: {
            validoAte: validoDesde,
          },
        });
      }

      // Create new version lines (copy from current)
      const newLines = [];
      for (const line of currentLines) {
        const created = await tx.bom.create({
          data: {
            produtoPaiId: line.produtoPaiId,
            produtoFilhoId: line.produtoFilhoId,
            quantidade: line.quantidade,
            unidadeMedidaId: line.unidadeMedidaId,
            perdaPercentual: line.perdaPercentual,
            nivel: line.nivel,
            observacao: line.observacao,
            versao: newVersion,
            ativo: true,
            validoDesde,
            validoAte: null,
          },
          include: {
            produtoFilho: { select: { id: true, codigo: true, descricao: true } },
          },
        });
        newLines.push(created);
      }

      return { versao: newVersion, validoDesde, lines: newLines };
    });

    return result;
  }

  /**
   * AC-4: Get all versions for a parent product with date ranges.
   */
  async getVersionHistory(produtoPaiId: string): Promise<BomVersionSummary[]> {
    const versions = await this.prisma.bom.groupBy({
      by: ['versao', 'validoDesde', 'validoAte'],
      where: { produtoPaiId },
      _count: { id: true },
      _min: { createdAt: true },
      orderBy: { versao: 'desc' },
    });

    // Group by version (since validoDesde/validoAte can differ across lines of same version in theory)
    const versionMap = new Map<number, BomVersionSummary>();
    for (const v of versions) {
      const existing = versionMap.get(v.versao);
      if (existing) {
        existing.lineCount += v._count.id;
      } else {
        versionMap.set(v.versao, {
          versao: v.versao,
          validoDesde: v.validoDesde,
          validoAte: v.validoAte,
          lineCount: v._count.id,
          createdAt: v._min.createdAt ?? new Date(0),
        });
      }
    }

    return [...versionMap.values()].sort((a, b) => b.versao - a.versao);
  }

  /**
   * AC-5: Get BOM lines effective at a specific date.
   */
  async getVersionAt(
    produtoPaiId: string,
    date: Date,
  ): Promise<BomVersionLine[]> {
    if (isNaN(date.getTime())) {
      throw new BadRequestException('date must be a valid date');
    }

    const lines = await this.prisma.bom.findMany({
      where: {
        produtoPaiId,
        ativo: true,
        OR: [
          {
            validoDesde: { lte: date },
            validoAte: null,
          },
          {
            validoDesde: { lte: date },
            validoAte: { gt: date },
          },
        ],
      },
      include: {
        produtoFilho: { select: { id: true, codigo: true, descricao: true } },
      },
      orderBy: { versao: 'desc' },
    });

    return lines.map((line) => ({
      id: line.id,
      produtoFilhoId: line.produtoFilhoId,
      produtoFilhoCodigo: (line as any).produtoFilho.codigo,
      produtoFilhoDescricao: (line as any).produtoFilho.descricao,
      quantidade: Number(line.quantidade),
      perdaPercentual: Number(line.perdaPercentual ?? 0),
      versao: line.versao,
      validoDesde: line.validoDesde,
      validoAte: line.validoAte,
    }));
  }

  /**
   * AC-6: Get current active version (validoAte is null).
   */
  async getCurrentVersion(produtoPaiId: string) {
    const maxVersion = await this.prisma.bom.aggregate({
      where: { produtoPaiId, ativo: true, validoAte: null },
      _max: { versao: true },
    });

    const currentVersion = maxVersion._max.versao;
    if (!currentVersion) {
      throw new NotFoundException(
        `No active BOM version found for product ${produtoPaiId}`,
      );
    }

    const lines = await this.prisma.bom.findMany({
      where: {
        produtoPaiId,
        versao: currentVersion,
        ativo: true,
        validoAte: null,
      },
      include: {
        produtoFilho: { select: { id: true, codigo: true, descricao: true } },
      },
    });

    return {
      versao: currentVersion,
      lineCount: lines.length,
      lines: lines.map((line) => ({
        id: line.id,
        produtoFilhoId: line.produtoFilhoId,
        produtoFilhoCodigo: (line as any).produtoFilho.codigo,
        produtoFilhoDescricao: (line as any).produtoFilho.descricao,
        quantidade: Number(line.quantidade),
        perdaPercentual: Number(line.perdaPercentual ?? 0),
        validoDesde: line.validoDesde,
      })),
    };
  }
}
