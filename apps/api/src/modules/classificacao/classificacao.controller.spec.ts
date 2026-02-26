import { NotFoundException } from '@nestjs/common';
import { ClassificacaoController } from './classificacao.controller';

const mockService = {
  findAll: jest.fn(),
  findByProdutoId: jest.fn(),
  update: jest.fn(),
  recalculate: jest.fn(),
};

describe('ClassificacaoController', () => {
  let controller: ClassificacaoController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ClassificacaoController(mockService as any);
  });

  it('should return paginated classifications', async () => {
    const paginated = {
      data: [],
      meta: { total: 0, page: 1, limit: 50, totalPages: 0, hasNext: false, hasPrev: false },
    };
    mockService.findAll.mockResolvedValue(paginated);
    const result = await controller.findAll({} as any);
    expect(result).toEqual(paginated);
  });

  it('should return classification by produtoId', async () => {
    mockService.findByProdutoId.mockResolvedValue({ produtoId: 'p1', classeAbc: 'A' });
    const result = await controller.findOne('p1');
    expect(result.classeAbc).toBe('A');
  });

  it('should propagate NotFoundException', async () => {
    mockService.findByProdutoId.mockRejectedValue(new NotFoundException());
    await expect(controller.findOne('x')).rejects.toThrow(NotFoundException);
  });

  it('should update classification', async () => {
    mockService.update.mockResolvedValue({ produtoId: 'p1', classeAbc: 'B' });
    const result = await controller.update('p1', { classeAbc: 'B' as any });
    expect(result.classeAbc).toBe('B');
  });

  it('should trigger recalculation', async () => {
    const recalcResult = { totalClassified: 10, distribution: {}, calculadoEm: '2026-02-26' };
    mockService.recalculate.mockResolvedValue(recalcResult);
    const result = await controller.recalculate();
    expect(result.totalClassified).toBe(10);
  });
});
