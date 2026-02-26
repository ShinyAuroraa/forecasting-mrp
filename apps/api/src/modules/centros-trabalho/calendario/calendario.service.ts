import { Injectable, NotFoundException } from '@nestjs/common';
import { CalendarioRepository } from './calendario.repository';
import { CreateCalendarioDto } from './dto/create-calendario.dto';
import { UpdateCalendarioDto } from './dto/update-calendario.dto';
import { FilterCalendarioDto } from './dto/filter-calendario.dto';

export interface BulkCreateResult {
  readonly created: number;
  readonly skipped: number;
}

@Injectable()
export class CalendarioService {
  constructor(private readonly repository: CalendarioRepository) {}

  async create(dto: CreateCalendarioDto) {
    return this.repository.create(dto);
  }

  async findAll(filters: FilterCalendarioDto) {
    return this.repository.findAll(filters);
  }

  async findById(id: string) {
    const calendario = await this.repository.findById(id);
    if (!calendario) {
      throw new NotFoundException(
        `CalendarioFabrica com id ${id} nao encontrado`,
      );
    }
    return calendario;
  }

  async update(id: string, dto: UpdateCalendarioDto) {
    await this.findById(id);
    return this.repository.update(id, dto);
  }

  async remove(id: string) {
    await this.findById(id);
    await this.repository.delete(id);
  }

  async bulkCreate(entries: CreateCalendarioDto[]): Promise<BulkCreateResult> {
    const result = await this.repository.bulkCreate(entries);
    return {
      created: result.count,
      skipped: entries.length - result.count,
    };
  }

  async countWorkingDays(start: Date, end: Date): Promise<number> {
    return this.repository.countWorkingDays(start, end);
  }
}
