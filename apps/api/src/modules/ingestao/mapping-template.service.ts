import { Injectable, NotFoundException } from '@nestjs/common';
import { MappingTemplateRepository } from './mapping-template.repository';
import { CreateMappingTemplateDto } from './dto/create-mapping-template.dto';
import { UpdateMappingTemplateDto } from './dto/update-mapping-template.dto';
import { FilterMappingTemplateDto } from './dto/filter-mapping-template.dto';

@Injectable()
export class MappingTemplateService {
  constructor(private readonly repository: MappingTemplateRepository) {}

  async create(dto: CreateMappingTemplateDto) {
    return this.repository.create(dto);
  }

  async findAll(filters: FilterMappingTemplateDto) {
    return this.repository.findAll(filters);
  }

  async findById(id: string) {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new NotFoundException(`Template de mapeamento com id ${id} não encontrado`);
    }
    return record;
  }

  async update(id: string, dto: UpdateMappingTemplateDto) {
    await this.findById(id);
    return this.repository.update(id, dto);
  }

  async delete(id: string) {
    await this.findById(id);
    return this.repository.delete(id);
  }

  async duplicate(id: string) {
    const result = await this.repository.duplicate(id);
    if (!result) {
      throw new NotFoundException(`Template de mapeamento com id ${id} não encontrado`);
    }
    return result;
  }

  async suggestTemplates(headers: string[]) {
    return this.repository.findByHeaders(headers);
  }

  async incrementUsage(id: string) {
    return this.repository.incrementUsage(id);
  }
}
