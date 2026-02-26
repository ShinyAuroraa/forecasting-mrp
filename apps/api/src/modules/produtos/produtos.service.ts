import { Injectable, NotFoundException } from '@nestjs/common';
import { ProdutosRepository } from './produtos.repository';
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { FilterProdutoDto } from './dto/filter-produto.dto';

@Injectable()
export class ProdutosService {
  constructor(private readonly repository: ProdutosRepository) {}

  async create(dto: CreateProdutoDto) {
    return this.repository.create(dto);
  }

  async findAll(filters: FilterProdutoDto) {
    return this.repository.findAll(filters);
  }

  async findById(id: string) {
    const produto = await this.repository.findById(id);
    if (!produto) {
      throw new NotFoundException(`Produto com id ${id} nao encontrado`);
    }
    return produto;
  }

  async update(id: string, dto: UpdateProdutoDto) {
    await this.findById(id);
    return this.repository.update(id, dto);
  }

  async remove(id: string) {
    await this.findById(id);
    await this.repository.softDelete(id);
  }
}
