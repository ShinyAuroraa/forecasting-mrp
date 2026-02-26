import { ImportTemplateService } from './import-template.service';

describe('ImportTemplateService', () => {
  let service: ImportTemplateService;

  beforeEach(() => {
    service = new ImportTemplateService();
  });

  it('should generate an XLSX buffer', async () => {
    const buffer = await service.generateTemplate();

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should contain XLSX magic bytes (PK zip header)', async () => {
    const buffer = await service.generateTemplate();

    // XLSX is a ZIP file, starts with PK (0x50 0x4B)
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });
});
