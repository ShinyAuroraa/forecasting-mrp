import { NotFoundException, ConflictException } from '@nestjs/common';
import { InventarioAtualService } from './inventario-atual.service';

const mockRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
};

describe('InventarioAtualService', () => {
  let service: InventarioAtualService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InventarioAtualService(mockRepository as any);
  });

  describe('create', () => {
    it('should create and add computed fields', async () => {
      const dto = { produtoId: 'p1', depositoId: 'd1' };
      mockRepository.create.mockResolvedValue({
        id: '1',
        ...dto,
        quantidadeDisponivel: 100,
        quantidadeReservada: 20,
        quantidadeEmQuarentena: 5,
        quantidadeEmTransito: 10,
        custoMedioUnitario: 2.5,
      });
      const result = await service.create(dto as any);
      expect(result.id).toBe('1');
      expect(result.quantidadeTotal).toBe(125);
      expect(result.valorTotalEstoque).toBe(312.5);
    });

    it('should throw ConflictException on unique constraint', async () => {
      mockRepository.create.mockRejectedValue(
        new Error('Unique constraint failed'),
      );
      await expect(service.create({} as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated results with computed fields', async () => {
      mockRepository.findAll.mockResolvedValue({
        data: [
          {
            id: '1',
            quantidadeDisponivel: 50,
            quantidadeReservada: 10,
            quantidadeEmQuarentena: 0,
            custoMedioUnitario: 3,
          },
        ],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1, hasNext: false, hasPrev: false },
      });
      const result = await service.findAll({} as any);
      expect(result.data[0].quantidadeTotal).toBe(60);
      expect(result.data[0].valorTotalEstoque).toBe(180);
    });
  });

  describe('findById', () => {
    it('should return with computed fields when found', async () => {
      mockRepository.findById.mockResolvedValue({
        id: '1',
        quantidadeDisponivel: 200,
        quantidadeReservada: 0,
        quantidadeEmQuarentena: 0,
        custoMedioUnitario: null,
      });
      const result = await service.findById('1');
      expect(result.quantidadeTotal).toBe(200);
      expect(result.valorTotalEstoque).toBeNull();
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(service.findById('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return computed fields', async () => {
      mockRepository.findById.mockResolvedValue({
        id: '1',
        quantidadeDisponivel: 100,
        quantidadeReservada: 0,
        quantidadeEmQuarentena: 0,
        custoMedioUnitario: 5,
      });
      mockRepository.update.mockResolvedValue({
        id: '1',
        quantidadeDisponivel: 150,
        quantidadeReservada: 0,
        quantidadeEmQuarentena: 0,
        custoMedioUnitario: 5,
      });
      const result = await service.update('1', { quantidadeDisponivel: 150 });
      expect(result.quantidadeTotal).toBe(150);
      expect(result.valorTotalEstoque).toBe(750);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(
        service.update('x', { quantidadeDisponivel: 10 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
