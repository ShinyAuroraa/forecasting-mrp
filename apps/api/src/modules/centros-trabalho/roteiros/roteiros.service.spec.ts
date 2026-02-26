import { NotFoundException, ConflictException } from '@nestjs/common';
import { RoteirosService } from './roteiros.service';

const mockRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  findByProdutoId: jest.fn(),
  findByProdutoIdAndSequencia: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

describe('RoteirosService', () => {
  let service: RoteirosService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RoteirosService(mockRepository as any);
  });

  describe('create', () => {
    it('should create a roteiro when sequence is unique', async () => {
      const dto = {
        produtoId: 'prod-1',
        centroTrabalhoId: 'ct-1',
        sequencia: 10,
        operacao: 'Corte',
        tempoUnitarioMinutos: 1.5,
      };
      mockRepository.findByProdutoIdAndSequencia.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({ id: 'r-1', ...dto });

      const result = await service.create(dto as any);

      expect(mockRepository.findByProdutoIdAndSequencia).toHaveBeenCalledWith(
        'prod-1',
        10,
        undefined,
      );
      expect(result.id).toBe('r-1');
      expect(result.operacao).toBe('Corte');
    });

    it('should throw ConflictException when sequence already exists for product', async () => {
      const dto = {
        produtoId: 'prod-1',
        centroTrabalhoId: 'ct-1',
        sequencia: 10,
        operacao: 'Corte',
        tempoUnitarioMinutos: 1.5,
      };
      mockRepository.findByProdutoIdAndSequencia.mockResolvedValue({
        id: 'existing',
      });

      await expect(service.create(dto as any)).rejects.toThrow(
        ConflictException,
      );
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should delegate to repository', async () => {
      const paginated = {
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
      mockRepository.findAll.mockResolvedValue(paginated);

      const result = await service.findAll({} as any);
      expect(result).toEqual(paginated);
    });
  });

  describe('findById', () => {
    it('should return roteiro when found', async () => {
      mockRepository.findById.mockResolvedValue({
        id: 'r-1',
        operacao: 'Corte',
      });

      const result = await service.findById('r-1');
      expect(result.id).toBe('r-1');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByProdutoId', () => {
    it('should delegate to repository', async () => {
      const roteiros = [
        { id: 'r-1', sequencia: 10 },
        { id: 'r-2', sequencia: 20 },
      ];
      mockRepository.findByProdutoId.mockResolvedValue(roteiros);

      const result = await service.findByProdutoId('prod-1');
      expect(result).toHaveLength(2);
      expect(mockRepository.findByProdutoId).toHaveBeenCalledWith('prod-1');
    });
  });

  describe('update', () => {
    it('should update when found and sequence is unique', async () => {
      mockRepository.findById.mockResolvedValue({
        id: 'r-1',
        produtoId: 'prod-1',
        sequencia: 10,
      });
      mockRepository.findByProdutoIdAndSequencia.mockResolvedValue(null);
      mockRepository.update.mockResolvedValue({
        id: 'r-1',
        sequencia: 20,
      });

      const result = await service.update('r-1', { sequencia: 20 } as any);
      expect(result.sequencia).toBe(20);
      expect(mockRepository.findByProdutoIdAndSequencia).toHaveBeenCalledWith(
        'prod-1',
        20,
        'r-1',
      );
    });

    it('should throw NotFoundException when roteiro not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { operacao: 'New' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when updating to duplicate sequence', async () => {
      mockRepository.findById.mockResolvedValue({
        id: 'r-1',
        produtoId: 'prod-1',
        sequencia: 10,
      });
      mockRepository.findByProdutoIdAndSequencia.mockResolvedValue({
        id: 'r-other',
      });

      await expect(
        service.update('r-1', { sequencia: 20 } as any),
      ).rejects.toThrow(ConflictException);
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should skip sequence validation when not changing sequence or produtoId', async () => {
      mockRepository.findById.mockResolvedValue({
        id: 'r-1',
        produtoId: 'prod-1',
        sequencia: 10,
      });
      mockRepository.update.mockResolvedValue({
        id: 'r-1',
        operacao: 'Solda',
      });

      const result = await service.update('r-1', {
        operacao: 'Solda',
      } as any);

      expect(result.operacao).toBe('Solda');
      expect(
        mockRepository.findByProdutoIdAndSequencia,
      ).not.toHaveBeenCalled();
    });

    it('should validate sequence when produtoId changes', async () => {
      mockRepository.findById.mockResolvedValue({
        id: 'r-1',
        produtoId: 'prod-1',
        sequencia: 10,
      });
      mockRepository.findByProdutoIdAndSequencia.mockResolvedValue(null);
      mockRepository.update.mockResolvedValue({
        id: 'r-1',
        produtoId: 'prod-2',
      });

      await service.update('r-1', { produtoId: 'prod-2' } as any);

      expect(mockRepository.findByProdutoIdAndSequencia).toHaveBeenCalledWith(
        'prod-2',
        10,
        'r-1',
      );
    });
  });

  describe('remove', () => {
    it('should soft-delete when found', async () => {
      mockRepository.findById.mockResolvedValue({ id: 'r-1' });
      mockRepository.softDelete.mockResolvedValue(undefined);

      await service.remove('r-1');
      expect(mockRepository.softDelete).toHaveBeenCalledWith('r-1');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepository.softDelete).not.toHaveBeenCalled();
    });
  });
});
