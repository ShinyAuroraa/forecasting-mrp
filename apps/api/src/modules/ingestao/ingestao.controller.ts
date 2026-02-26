import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IngestaoService } from './ingestao.service';
import { IngestaoUploadService } from './ingestao-upload.service';
import { CreateSerieTemporalDto } from './dto/create-serie-temporal.dto';
import { FilterSerieTemporalDto } from './dto/filter-serie-temporal.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../common/pipes/uuid-validation.pipe';

@Controller('series-temporais')
export class SeriesTemporaisController {
  constructor(private readonly ingestaoService: IngestaoService) {}

  @Post()
  @Roles('operator')
  create(@Body() dto: CreateSerieTemporalDto) {
    return this.ingestaoService.create(dto);
  }

  @Get()
  @Roles('viewer')
  findAll(@Query() filters: FilterSerieTemporalDto) {
    return this.ingestaoService.findAll(filters);
  }

  @Get(':id')
  @Roles('viewer')
  findOne(@Param('id', UuidValidationPipe) id: string) {
    return this.ingestaoService.findById(id);
  }
}

@Controller('ingestao')
export class IngestaoController {
  constructor(private readonly uploadService: IngestaoUploadService) {}

  @Post('upload')
  @Roles('operator')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { templateId?: string; granularidade?: string },
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.uploadService.processUpload(
      file,
      body.granularidade,
      body.templateId,
    );
  }

  @Post('upload/suggest-template')
  @Roles('operator')
  @UseInterceptors(FileInterceptor('file'))
  async suggestTemplate(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const headers = await this.uploadService.extractHeaders(file);
    return { headers };
  }
}
