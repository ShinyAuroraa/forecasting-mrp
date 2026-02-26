import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BomVersionService } from './bom-version.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('BomVersionService', () => {
  let service: BomVersionService;
  let mockBom: Record<string, jest.Mock>;
  let mockTxBom: Record<string, jest.Mock>;
  let mockPrisma: Record<string, unknown>;

  const baseLine = {
    id: 'bom-1',
    produtoPaiId: 'pai-1',
    produtoFilhoId: 'filho-1',
    quantidade: 10,
    unidadeMedidaId: 'um-1',
    perdaPercentual: 2.5,
    nivel: 1,
    observacao: null,
    versao: 1,
    ativo: true,
    validoDesde: new Date('2026-01-01'),
    validoAte: null,
    createdAt: new Date('2026-01-01'),
  };

  const lineWithRelation = {
    ...baseLine,
    produtoFilho: { id: 'filho-1', codigo: 'COMP-001', descricao: 'Componente A' },
  };

  beforeEach(async () => {
    // Transaction-scoped mock (aggregate + findMany + updateMany + create all inside tx)
    mockTxBom = {
      aggregate: jest.fn().mockResolvedValue({ _max: { versao: 1 } }),
      findMany: jest.fn().mockResolvedValue([baseLine]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockImplementation((args) =>
        Promise.resolve({ ...args.data, id: 'new-bom-1', produtoFilho: lineWithRelation.produtoFilho }),
      ),
    };

    // Non-transaction Prisma mock (for getVersionHistory, getVersionAt, getCurrentVersion)
    mockBom = {
      aggregate: jest.fn().mockResolvedValue({ _max: { versao: 1 } }),
      findMany: jest.fn().mockResolvedValue([lineWithRelation]),
      groupBy: jest.fn().mockResolvedValue([]),
    };

    mockPrisma = {
      bom: mockBom,
      $transaction: jest.fn().mockImplementation(async (fn) =>
        fn({ bom: mockTxBom }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BomVersionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BomVersionService>(BomVersionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- AC-3, AC-7: createNewVersion ---

  describe('createNewVersion — AC-3, AC-7', () => {
    it('should create a new version by copying current lines', async () => {
      const result = await service.createNewVersion('pai-1');

      expect(result.versao).toBe(2);
      expect(result.lines).toHaveLength(1);
      expect(mockTxBom.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            produtoPaiId: 'pai-1',
            produtoFilhoId: 'filho-1',
            versao: 2,
          }),
        }),
      );
    });

    it('should close previous version atomically (AC-7)', async () => {
      await service.createNewVersion('pai-1');

      expect(mockTxBom.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            produtoPaiId: 'pai-1',
            versao: 1,
            ativo: true,
            validoAte: null,
          }),
          data: expect.objectContaining({
            validoAte: expect.any(Date),
          }),
        }),
      );
    });

    it('should use provided validoDesde date', async () => {
      const futureDate = new Date('2026-06-01');
      const result = await service.createNewVersion('pai-1', futureDate);

      expect(result.validoDesde).toEqual(futureDate);
      expect(mockTxBom.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            validoDesde: futureDate,
            validoAte: null,
          }),
        }),
      );
    });

    it('should handle first version (no previous version) — AC-13', async () => {
      mockTxBom.aggregate.mockResolvedValue({ _max: { versao: null } });

      const result = await service.createNewVersion('pai-1');

      expect(result.versao).toBe(1);
      expect(result.lines).toHaveLength(0);
      // Should NOT attempt to close previous version or fetch lines
      expect(mockTxBom.updateMany).not.toHaveBeenCalled();
      expect(mockTxBom.findMany).not.toHaveBeenCalled();
    });

    it('should run reads and writes in a single transaction (AC-7)', async () => {
      await service.createNewVersion('pai-1');

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      // aggregate and findMany should be called on tx, not on prisma.bom
      expect(mockTxBom.aggregate).toHaveBeenCalledTimes(1);
      expect(mockTxBom.findMany).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException for invalid date', async () => {
      await expect(
        service.createNewVersion('pai-1', new Date('invalid')),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // --- AC-4: getVersionHistory ---

  describe('getVersionHistory — AC-4', () => {
    it('should return version summaries sorted by version desc', async () => {
      mockBom.groupBy.mockResolvedValue([
        { versao: 2, validoDesde: new Date('2026-03-01'), validoAte: null, _count: { id: 3 }, _min: { createdAt: new Date() } },
        { versao: 1, validoDesde: new Date('2026-01-01'), validoAte: new Date('2026-03-01'), _count: { id: 3 }, _min: { createdAt: new Date() } },
      ]);

      const result = await service.getVersionHistory('pai-1');

      expect(result).toHaveLength(2);
      expect(result[0].versao).toBe(2);
      expect(result[1].versao).toBe(1);
      expect(result[0].validoAte).toBeNull();
      expect(result[1].validoAte).toEqual(new Date('2026-03-01'));
    });

    it('should return empty array when no versions exist', async () => {
      mockBom.groupBy.mockResolvedValue([]);

      const result = await service.getVersionHistory('pai-1');
      expect(result).toHaveLength(0);
    });

    it('should aggregate line counts per version', async () => {
      mockBom.groupBy.mockResolvedValue([
        { versao: 1, validoDesde: new Date(), validoAte: null, _count: { id: 2 }, _min: { createdAt: new Date() } },
        { versao: 1, validoDesde: new Date(), validoAte: null, _count: { id: 1 }, _min: { createdAt: new Date() } },
      ]);

      const result = await service.getVersionHistory('pai-1');

      expect(result).toHaveLength(1);
      expect(result[0].lineCount).toBe(3);
    });

    it('should handle null createdAt gracefully', async () => {
      mockBom.groupBy.mockResolvedValue([
        { versao: 1, validoDesde: new Date(), validoAte: null, _count: { id: 1 }, _min: { createdAt: null } },
      ]);

      const result = await service.getVersionHistory('pai-1');
      expect(result[0].createdAt).toEqual(new Date(0));
    });
  });

  // --- AC-5: getVersionAt ---

  describe('getVersionAt — AC-5', () => {
    it('should return BOM lines effective at a specific date', async () => {
      mockBom.findMany.mockResolvedValue([lineWithRelation]);

      const result = await service.getVersionAt('pai-1', new Date('2026-02-15'));

      expect(result).toHaveLength(1);
      expect(result[0].produtoFilhoCodigo).toBe('COMP-001');
      expect(result[0].quantidade).toBe(10);
      expect(result[0].perdaPercentual).toBe(2.5);
    });

    it('should return empty array when no lines match date', async () => {
      mockBom.findMany.mockResolvedValue([]);

      const result = await service.getVersionAt('pai-1', new Date('2020-01-01'));
      expect(result).toHaveLength(0);
    });

    it('should query with correct date range conditions (no legacy clause)', async () => {
      mockBom.findMany.mockResolvedValue([]);
      const targetDate = new Date('2026-02-15');

      await service.getVersionAt('pai-1', targetDate);

      expect(mockBom.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            produtoPaiId: 'pai-1',
            ativo: true,
            OR: [
              { validoDesde: { lte: targetDate }, validoAte: null },
              { validoDesde: { lte: targetDate }, validoAte: { gt: targetDate } },
            ],
          }),
        }),
      );
    });

    it('should throw BadRequestException for invalid date', async () => {
      await expect(
        service.getVersionAt('pai-1', new Date('invalid')),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // --- AC-6: getCurrentVersion ---

  describe('getCurrentVersion — AC-6', () => {
    it('should return the current active version', async () => {
      mockBom.aggregate.mockResolvedValue({ _max: { versao: 2 } });
      mockBom.findMany.mockResolvedValue([lineWithRelation]);

      const result = await service.getCurrentVersion('pai-1');

      expect(result.versao).toBe(2);
      expect(result.lineCount).toBe(1);
      expect(result.lines[0].produtoFilhoCodigo).toBe('COMP-001');
    });

    it('should throw NotFoundException when no active version exists', async () => {
      mockBom.aggregate.mockResolvedValue({ _max: { versao: null } });

      await expect(service.getCurrentVersion('pai-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
