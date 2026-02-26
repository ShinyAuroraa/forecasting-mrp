import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ProdutoFornecedorRepository } from './produto-fornecedor.repository';
import { CreateProdutoFornecedorDto } from './dto/create-produto-fornecedor.dto';
import { UpdateProdutoFornecedorDto } from './dto/update-produto-fornecedor.dto';
import { FilterProdutoFornecedorDto } from './dto/filter-produto-fornecedor.dto';

@Injectable()
export class ProdutoFornecedorService {
  constructor(private readonly repository: ProdutoFornecedorRepository) {}

  async create(dto: CreateProdutoFornecedorDto) {
    try {
      return await this.repository.create(dto);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes('Unique constraint')
      ) {
        throw new ConflictException(
          'Linkage between this product and supplier already exists',
        );
      }
      throw error;
    }
  }

  async findAll(filters: FilterProdutoFornecedorDto) {
    return this.repository.findAll(filters);
  }

  async findById(id: string) {
    const linkage = await this.repository.findById(id);
    if (!linkage) {
      throw new NotFoundException(
        `ProdutoFornecedor com id ${id} nao encontrado`,
      );
    }
    return linkage;
  }

  async update(id: string, dto: UpdateProdutoFornecedorDto) {
    const existing = await this.findById(id);
    return this.repository.update(id, dto, existing.produtoId);
  }

  async remove(id: string) {
    await this.findById(id);
    await this.repository.delete(id);
  }
}
