import { Injectable, NotFoundException } from '@nestjs/common';
import { TurnosRepository } from './turnos.repository';
import { CreateTurnoDto } from './dto/create-turno.dto';
import { UpdateTurnoDto } from './dto/update-turno.dto';
import { FilterTurnoDto } from './dto/filter-turno.dto';

@Injectable()
export class TurnosService {
  constructor(private readonly repository: TurnosRepository) {}

  async create(dto: CreateTurnoDto) {
    return this.repository.create(dto);
  }

  async findAll(filters: FilterTurnoDto) {
    return this.repository.findAll(filters);
  }

  async findById(id: string) {
    const turno = await this.repository.findById(id);
    if (!turno) {
      throw new NotFoundException(`Turno com id ${id} nao encontrado`);
    }
    return turno;
  }

  async update(id: string, dto: UpdateTurnoDto) {
    await this.findById(id);
    return this.repository.update(id, dto);
  }

  async remove(id: string) {
    await this.findById(id);
    await this.repository.softDelete(id);
  }
}
