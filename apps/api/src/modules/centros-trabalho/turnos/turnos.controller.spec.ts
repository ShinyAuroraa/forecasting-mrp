import { NotFoundException } from '@nestjs/common';
import { TurnosController } from './turnos.controller';

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('TurnosController', () => {
  let controller: TurnosController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new TurnosController(mockService as any);
  });

  describe('POST /turnos', () => {
    it('should create a shift', async () => {
      const dto = { centroTrabalhoId: 'ct1', nome: 'Turno 1', horaInicio: '06:00', horaFim: '14:00', diasSemana: [1, 2, 3, 4, 5] };
      mockService.create.mockResolvedValue({ id: '1', ...dto });

      const result = await controller.create(dto as any);
      expect(result.nome).toBe('Turno 1');
    });
  });

  describe('GET /turnos', () => {
    it('should return paginated shifts', async () => {
      const paginated = { data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 0, hasNext: false, hasPrev: false } };
      mockService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({} as any);
      expect(result).toEqual(paginated);
    });
  });

  describe('GET /turnos/:id', () => {
    it('should return shift by id', async () => {
      mockService.findById.mockResolvedValue({ id: '1' });
      const result = await controller.findOne('1');
      expect(result.id).toBe('1');
    });

    it('should propagate NotFoundException', async () => {
      mockService.findById.mockRejectedValue(new NotFoundException());
      await expect(controller.findOne('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('PATCH /turnos/:id', () => {
    it('should update shift', async () => {
      mockService.update.mockResolvedValue({ id: '1', nome: 'Updated' });
      const result = await controller.update('1', { nome: 'Updated' });
      expect(result.nome).toBe('Updated');
    });
  });

  describe('DELETE /turnos/:id', () => {
    it('should soft-delete shift', async () => {
      mockService.remove.mockResolvedValue(undefined);
      await controller.remove('1');
      expect(mockService.remove).toHaveBeenCalledWith('1');
    });
  });
});
