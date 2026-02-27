import { Test } from '@nestjs/testing';
import { ExportController } from '../export.controller';
import { ExportService } from '../export.service';

describe('ExportController', () => {
  let controller: ExportController;
  let service: Record<string, jest.Mock>;

  const mockRes = () => {
    const res: any = {};
    res.setHeader = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  const mockReq = () => ({ user: { sub: 'user-1' } } as any);

  beforeEach(async () => {
    service = {
      requestExport: jest.fn().mockResolvedValue({ sync: true, buffer: Buffer.from('data') }),
      getDownloadFile: jest.fn().mockResolvedValue({ buffer: Buffer.from('file'), fileName: 'test.xlsx', format: 'xlsx' }),
      getHistory: jest.fn().mockResolvedValue([]),
    };

    const module = await Test.createTestingModule({
      controllers: [ExportController],
      providers: [{ provide: ExportService, useValue: service }],
    }).compile();

    controller = module.get(ExportController);
  });

  it('POST /export/excel should generate Excel export', async () => {
    const res = mockRes();
    await controller.exportExcel({ type: 'MRP_ORDERS' } as any, mockReq(), res);

    expect(service.requestExport).toHaveBeenCalledWith('MRP_ORDERS', 'xlsx', {}, 'user-1');
    expect(res.send).toHaveBeenCalled();
  });

  it('POST /export/pdf should generate PDF export', async () => {
    const res = mockRes();
    await controller.exportPdf({ type: 'EXECUTIVE_DASHBOARD' } as any, mockReq(), res);

    expect(service.requestExport).toHaveBeenCalledWith('EXECUTIVE_DASHBOARD', 'pdf', {}, 'user-1');
    expect(res.send).toHaveBeenCalled();
  });

  it('POST /export/excel should return 202 for async jobs', async () => {
    service.requestExport.mockResolvedValue({ sync: false, jobId: 'job-999' });

    const res = mockRes();
    await controller.exportExcel({ type: 'MRP_ORDERS' } as any, mockReq(), res);

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'job-999' }));
  });

  it('GET /export/:jobId/download should stream file', async () => {
    const res = mockRes();
    await controller.download('job-1', res);

    expect(service.getDownloadFile).toHaveBeenCalledWith('job-1');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', expect.any(String));
    expect(res.send).toHaveBeenCalled();
  });

  it('GET /export/history should return export list', async () => {
    const result = await controller.history(mockReq());
    expect(service.getHistory).toHaveBeenCalledWith('user-1', 20);
    expect(result).toEqual([]);
  });
});
