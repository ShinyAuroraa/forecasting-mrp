import { Injectable, NotFoundException } from '@nestjs/common';
import { DepositosRepository } from './depositos.repository';
import { CreateDepositoDto } from './dto/create-deposito.dto';
import { UpdateDepositoDto } from './dto/update-deposito.dto';
import { FilterDepositoDto } from './dto/filter-deposito.dto';

@Injectable()
export class DepositosService {
  constructor(private readonly repository: DepositosRepository) {}

  async create(dto: CreateDepositoDto) {
    return this.repository.create(dto);
  }

  async findAll(filters: FilterDepositoDto) {
    return this.repository.findAll(filters);
  }

  async findById(id: string) {
    const deposito = await this.repository.findById(id);
    if (!deposito) {
      throw new NotFoundException(`Deposito com id ${id} nao encontrado`);
    }
    return deposito;
  }

  async update(id: string, dto: UpdateDepositoDto) {
    await this.findById(id);
    return this.repository.update(id, dto);
  }

  async remove(id: string) {
    await this.findById(id);
    await this.repository.softDelete(id);
  }
}
