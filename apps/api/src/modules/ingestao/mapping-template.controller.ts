import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MappingTemplateService } from './mapping-template.service';
import { CreateMappingTemplateDto } from './dto/create-mapping-template.dto';
import { UpdateMappingTemplateDto } from './dto/update-mapping-template.dto';
import { FilterMappingTemplateDto } from './dto/filter-mapping-template.dto';
import { SuggestTemplatesDto } from './dto/suggest-templates.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../common/pipes/uuid-validation.pipe';

@Controller('ingestion/templates')
export class MappingTemplateController {
  constructor(private readonly templateService: MappingTemplateService) {}

  @Get()
  @Roles('viewer')
  findAll(@Query() filters: FilterMappingTemplateDto) {
    return this.templateService.findAll(filters);
  }

  @Post()
  @Roles('operator')
  create(@Body() dto: CreateMappingTemplateDto) {
    return this.templateService.create(dto);
  }

  @Post('suggest')
  @Roles('viewer')
  suggest(@Body() dto: SuggestTemplatesDto) {
    return this.templateService.suggestTemplates(dto.headers);
  }

  @Get(':id')
  @Roles('viewer')
  findOne(@Param('id', UuidValidationPipe) id: string) {
    return this.templateService.findById(id);
  }

  @Put(':id')
  @Roles('operator')
  update(
    @Param('id', UuidValidationPipe) id: string,
    @Body() dto: UpdateMappingTemplateDto,
  ) {
    return this.templateService.update(id, dto);
  }

  @Delete(':id')
  @Roles('operator')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', UuidValidationPipe) id: string) {
    await this.templateService.delete(id);
  }

  @Post(':id/duplicate')
  @Roles('operator')
  duplicate(@Param('id', UuidValidationPipe) id: string) {
    return this.templateService.duplicate(id);
  }
}
