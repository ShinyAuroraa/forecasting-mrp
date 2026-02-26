import { Module } from '@nestjs/common';
import { SeriesTemporaisController } from './ingestao.controller';
import { IngestaoController } from './ingestao.controller';
import { MappingTemplateController } from './mapping-template.controller';
import { IngestaoService } from './ingestao.service';
import { IngestaoRepository } from './ingestao.repository';
import { IngestaoUploadService } from './ingestao-upload.service';
import { MappingTemplateService } from './mapping-template.service';
import { MappingTemplateRepository } from './mapping-template.repository';

@Module({
  controllers: [
    SeriesTemporaisController,
    IngestaoController,
    MappingTemplateController,
  ],
  providers: [
    IngestaoService,
    IngestaoRepository,
    IngestaoUploadService,
    MappingTemplateService,
    MappingTemplateRepository,
  ],
  exports: [IngestaoService, IngestaoUploadService, MappingTemplateService, MappingTemplateRepository],
})
export class IngestaoModule {}
