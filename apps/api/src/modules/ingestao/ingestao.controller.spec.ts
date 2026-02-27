import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SeriesTemporaisController, IngestaoController } from './ingestao.controller';

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
};

const mockUploadService = {
  processUpload: jest.fn(),
};

describe('SeriesTemporaisController', () => {
  let controller: SeriesTemporaisController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new SeriesTemporaisController(mockService as any);
  });

  it('should create a time-series record', async () => {
    mockService.create.mockResolvedValue({ id: '1' });
    const result = await controller.create({} as any);
    expect(result.id).toBe('1');
  });

  it('should return paginated records', async () => {
    const paginated = {
      data: [],
      meta: { total: 0, page: 1, limit: 50, totalPages: 0, hasNext: false, hasPrev: false },
    };
    mockService.findAll.mockResolvedValue(paginated);
    const result = await controller.findAll({} as any);
    expect(result).toEqual(paginated);
  });

  it('should return record by id', async () => {
    mockService.findById.mockResolvedValue({ id: '1' });
    const result = await controller.findOne('1');
    expect(result.id).toBe('1');
  });

  it('should propagate NotFoundException', async () => {
    mockService.findById.mockRejectedValue(new NotFoundException());
    await expect(controller.findOne('x')).rejects.toThrow(NotFoundException);
  });
});

describe('IngestaoController', () => {
  let controller: IngestaoController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new IngestaoController(mockUploadService as any);
  });

  it('should process uploaded file', async () => {
    const result = { imported: 5, updated: 2, rejected: 1, errors: [] };
    mockUploadService.processUpload.mockResolvedValue(result);
    const file = { buffer: Buffer.from(''), originalname: 'test.csv' } as Express.Multer.File;
    const response = await controller.upload(file, {} as any);
    expect(response.imported).toBe(5);
  });

  it('should throw BadRequestException when no file', async () => {
    await expect(controller.upload(undefined as any, {} as any)).rejects.toThrow(
      BadRequestException,
    );
  });
});
