import { Injectable, NotFoundException } from '@nestjs/common';
import { FornecedoresRepository } from './fornecedores.repository';
import { CreateFornecedorDto } from './dto/create-fornecedor.dto';
import { UpdateFornecedorDto } from './dto/update-fornecedor.dto';
import { FilterFornecedorDto } from './dto/filter-fornecedor.dto';

@Injectable()
export class FornecedoresService {
  constructor(private readonly repository: FornecedoresRepository) {}

  async create(dto: CreateFornecedorDto) {
    return this.repository.create(dto);
  }

  async findAll(filters: FilterFornecedorDto) {
    return this.repository.findAll(filters);
  }

  async findById(id: string) {
    const fornecedor = await this.repository.findById(id);
    if (!fornecedor) {
      throw new NotFoundException(`Fornecedor com id ${id} nao encontrado`);
    }
    return fornecedor;
  }

  async update(id: string, dto: UpdateFornecedorDto) {
    await this.findById(id);
    return this.repository.update(id, dto);
  }

  async remove(id: string) {
    await this.findById(id);
    await this.repository.softDelete(id);
  }
}
