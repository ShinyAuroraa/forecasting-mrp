import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { RoteirosRepository } from './roteiros.repository';
import { CreateRoteiroDto } from './dto/create-roteiro.dto';
import { UpdateRoteiroDto } from './dto/update-roteiro.dto';
import { FilterRoteiroDto } from './dto/filter-roteiro.dto';

@Injectable()
export class RoteirosService {
  constructor(private readonly repository: RoteirosRepository) {}

  async create(dto: CreateRoteiroDto) {
    await this.validateSequenceUniqueness(dto.produtoId, dto.sequencia);
    return this.repository.create(dto);
  }

  async findAll(filters: FilterRoteiroDto) {
    return this.repository.findAll(filters);
  }

  async findById(id: string) {
    const roteiro = await this.repository.findById(id);
    if (!roteiro) {
      throw new NotFoundException(`Roteiro com id ${id} nao encontrado`);
    }
    return roteiro;
  }

  async findByProdutoId(produtoId: string) {
    return this.repository.findByProdutoId(produtoId);
  }

  async update(id: string, dto: UpdateRoteiroDto) {
    const existing = await this.findById(id);

    if (dto.sequencia !== undefined || dto.produtoId !== undefined) {
      const produtoId = dto.produtoId ?? existing.produtoId;
      const sequencia = dto.sequencia ?? existing.sequencia;
      await this.validateSequenceUniqueness(produtoId, sequencia, id);
    }

    return this.repository.update(id, dto);
  }

  async remove(id: string) {
    await this.findById(id);
    await this.repository.softDelete(id);
  }

  private async validateSequenceUniqueness(
    produtoId: string,
    sequencia: number,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.repository.findByProdutoIdAndSequencia(
      produtoId,
      sequencia,
      excludeId,
    );

    if (existing) {
      throw new ConflictException(
        `Sequencia ${sequencia} ja existe para o produto ${produtoId}`,
      );
    }
  }
}
