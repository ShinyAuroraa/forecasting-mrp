import { NotFoundException } from '@nestjs/common';
import { CentrosTrabalhoController } from './centros-trabalho.controller';

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findByIdWithCapacity: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('CentrosTrabalhoController', () => {
  let controller: CentrosTrabalhoController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new CentrosTrabalhoController(mockService as any);
  });

  describe('POST /centros-trabalho', () => {
    it('should create a work center', async () => {
      const dto = { codigo: 'CT-001', nome: 'Linha 1', tipo: 'PRODUCAO' as any };
      mockService.create.mockResolvedValue({ id: '1', ...dto });

      const result = await controller.create(dto as any);
      expect(result.codigo).toBe('CT-001');
    });
  });

  describe('GET /centros-trabalho', () => {
    it('should return paginated results', async () => {
      const paginated = { data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 0, hasNext: false, hasPrev: false } };
      mockService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({} as any);
      expect(result).toEqual(paginated);
    });
  });

  describe('GET /centros-trabalho/:id', () => {
    it('should return work center with capacity', async () => {
      mockService.findByIdWithCapacity.mockResolvedValue({ id: '1', capacity: {} });

      const result = await controller.findOne('1');
      expect(result.id).toBe('1');
    });

    it('should propagate NotFoundException', async () => {
      mockService.findByIdWithCapacity.mockRejectedValue(new NotFoundException());
      await expect(controller.findOne('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('PATCH /centros-trabalho/:id', () => {
    it('should update work center', async () => {
      mockService.update.mockResolvedValue({ id: '1', nome: 'Updated' });

      const result = await controller.update('1', { nome: 'Updated' });
      expect(result.nome).toBe('Updated');
    });
  });

  describe('DELETE /centros-trabalho/:id', () => {
    it('should soft-delete work center', async () => {
      mockService.remove.mockResolvedValue(undefined);
      await controller.remove('1');
      expect(mockService.remove).toHaveBeenCalledWith('1');
    });
  });
});
