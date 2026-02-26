import { NotFoundException } from '@nestjs/common';
import { IngestaoService } from './ingestao.service';

const mockRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  upsert: jest.fn(),
};

describe('IngestaoService', () => {
  let service: IngestaoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IngestaoService(mockRepository as any);
  });

  describe('create', () => {
    it('should delegate to repository', async () => {
      const dto = { produtoId: 'p1', dataReferencia: '2026-01-01', volume: 100 };
      mockRepository.create.mockResolvedValue({ id: '1', ...dto });
      const result = await service.create(dto as any);
      expect(result.id).toBe('1');
      expect(mockRepository.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const paginated = {
        data: [{ id: '1' }],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockRepository.findAll.mockResolvedValue(paginated);
      const result = await service.findAll({} as any);
      expect(result).toEqual(paginated);
    });
  });

  describe('findById', () => {
    it('should return when found', async () => {
      mockRepository.findById.mockResolvedValue({ id: '1' });
      const result = await service.findById('1');
      expect(result.id).toBe('1');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(service.findById('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsert', () => {
    it('should delegate to repository', async () => {
      const dto = { produtoId: 'p1', dataReferencia: '2026-01-01', volume: 100 };
      mockRepository.upsert.mockResolvedValue({ id: '1', ...dto });
      const result = await service.upsert(dto as any);
      expect(result.id).toBe('1');
    });
  });
});
