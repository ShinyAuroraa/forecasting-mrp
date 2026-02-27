import {
  Controller,
  Post,
  Get,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../auth/decorators/public.decorator';
import { ErpImportService } from './erp-import.service';
import { ImportResultDto, ImportStatusDto } from './dto/import-result.dto';

@Public()
@Controller('erp-import')
export class ErpImportController {
  constructor(private readonly service: ErpImportService) {}

  @Post('produtos')
  @UseInterceptors(FileInterceptor('file'))
  async importProdutos(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportResultDto> {
    this.validateFile(file);
    return this.service.importProdutos(file.buffer, file.originalname);
  }

  @Post('faturamento')
  @UseInterceptors(FileInterceptor('file'))
  async importFaturamento(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportResultDto> {
    this.validateFile(file);
    return this.service.importFaturamento(file.buffer, file.originalname);
  }

  @Post('movimentacao')
  @UseInterceptors(FileInterceptor('file'))
  async importMovimentacao(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportResultDto> {
    this.validateFile(file);
    return this.service.importMovimentacao(file.buffer, file.originalname);
  }

  @Post('inventario')
  @UseInterceptors(FileInterceptor('file'))
  async importInventario(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportResultDto> {
    this.validateFile(file);
    return this.service.importInventario(file.buffer, file.originalname);
  }

  @Post('composicao')
  @UseInterceptors(FileInterceptor('file'))
  async importComposicao(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportResultDto> {
    this.validateFile(file);
    return this.service.importComposicao(file.buffer, file.originalname);
  }

  @Get('status')
  async getStatus(): Promise<ImportStatusDto> {
    return this.service.getStatus();
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }
    const allowed = [
      'application/pdf',
      'application/x-pdf',
      'application/octet-stream',
    ];
    if (
      !allowed.includes(file.mimetype) &&
      !file.originalname.toLowerCase().endsWith('.pdf')
    ) {
      throw new BadRequestException(
        `Formato inválido: ${file.mimetype}. Envie um arquivo PDF.`,
      );
    }
  }
}
