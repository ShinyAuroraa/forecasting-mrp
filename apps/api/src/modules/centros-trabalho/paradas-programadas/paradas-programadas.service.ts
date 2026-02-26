import { Injectable, NotFoundException } from '@nestjs/common';
import { ParadasProgramadasRepository } from './paradas-programadas.repository';
import { CreateParadaProgramadaDto } from './dto/create-parada-programada.dto';
import { UpdateParadaProgramadaDto } from './dto/update-parada-programada.dto';
import { FilterParadaProgramadaDto } from './dto/filter-parada-programada.dto';

@Injectable()
export class ParadasProgramadasService {
  constructor(private readonly repository: ParadasProgramadasRepository) {}

  async create(dto: CreateParadaProgramadaDto) {
    return this.repository.create(dto);
  }

  async findAll(filters: FilterParadaProgramadaDto) {
    return this.repository.findAll(filters);
  }

  async findById(id: string) {
    const parada = await this.repository.findById(id);
    if (!parada) {
      throw new NotFoundException(`ParadaProgramada com id ${id} nao encontrada`);
    }
    return parada;
  }

  async update(id: string, dto: UpdateParadaProgramadaDto) {
    await this.findById(id);
    return this.repository.update(id, dto);
  }

  async remove(id: string) {
    await this.findById(id);
    await this.repository.delete(id);
  }
}
