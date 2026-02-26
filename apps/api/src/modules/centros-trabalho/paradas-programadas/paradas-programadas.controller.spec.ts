import { NotFoundException } from '@nestjs/common';
import { ParadasProgramadasController } from './paradas-programadas.controller';

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('ParadasProgramadasController', () => {
  let controller: ParadasProgramadasController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ParadasProgramadasController(mockService as any);
  });

  it('should create a stop', async () => {
    mockService.create.mockResolvedValue({ id: '1' });
    const result = await controller.create({} as any);
    expect(result.id).toBe('1');
  });

  it('should return paginated stops', async () => {
    const paginated = { data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 0, hasNext: false, hasPrev: false } };
    mockService.findAll.mockResolvedValue(paginated);
    const result = await controller.findAll({} as any);
    expect(result).toEqual(paginated);
  });

  it('should return stop by id', async () => {
    mockService.findById.mockResolvedValue({ id: '1' });
    const result = await controller.findOne('1');
    expect(result.id).toBe('1');
  });

  it('should propagate NotFoundException', async () => {
    mockService.findById.mockRejectedValue(new NotFoundException());
    await expect(controller.findOne('x')).rejects.toThrow(NotFoundException);
  });

  it('should update stop', async () => {
    mockService.update.mockResolvedValue({ id: '1' });
    const result = await controller.update('1', {} as any);
    expect(result.id).toBe('1');
  });

  it('should delete stop', async () => {
    mockService.remove.mockResolvedValue(undefined);
    await controller.remove('1');
    expect(mockService.remove).toHaveBeenCalledWith('1');
  });
});
