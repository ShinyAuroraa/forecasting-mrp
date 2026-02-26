import { Injectable, NotFoundException } from '@nestjs/common';
import { IngestaoRepository } from './ingestao.repository';
import { CreateSerieTemporalDto } from './dto/create-serie-temporal.dto';
import { FilterSerieTemporalDto } from './dto/filter-serie-temporal.dto';

@Injectable()
export class IngestaoService {
  constructor(private readonly repository: IngestaoRepository) {}

  async create(dto: CreateSerieTemporalDto) {
    return this.repository.create(dto);
  }

  async findAll(filters: FilterSerieTemporalDto) {
    return this.repository.findAll(filters);
  }

  async findById(id: string) {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new NotFoundException(`Serie temporal com id ${id} nao encontrada`);
    }
    return record;
  }

  async upsert(dto: CreateSerieTemporalDto) {
    return this.repository.upsert(dto);
  }
}
