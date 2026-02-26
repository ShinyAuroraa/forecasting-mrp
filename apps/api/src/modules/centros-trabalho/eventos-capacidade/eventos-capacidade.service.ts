import { Injectable, NotFoundException } from '@nestjs/common';
import { EventosCapacidadeRepository } from './eventos-capacidade.repository';
import { CreateEventoCapacidadeDto } from './dto/create-evento-capacidade.dto';
import { UpdateEventoCapacidadeDto } from './dto/update-evento-capacidade.dto';
import { FilterEventoCapacidadeDto } from './dto/filter-evento-capacidade.dto';

@Injectable()
export class EventosCapacidadeService {
  constructor(private readonly repository: EventosCapacidadeRepository) {}

  async create(dto: CreateEventoCapacidadeDto) {
    return this.repository.create(dto);
  }

  async findAll(filters: FilterEventoCapacidadeDto) {
    return this.repository.findAll(filters);
  }

  async findById(id: string) {
    const evento = await this.repository.findById(id);
    if (!evento) {
      throw new NotFoundException(`EventoCapacidade com id ${id} nao encontrado`);
    }
    return evento;
  }

  async update(id: string, dto: UpdateEventoCapacidadeDto) {
    await this.findById(id);
    return this.repository.update(id, dto);
  }
}
