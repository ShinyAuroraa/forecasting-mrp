import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InventarioAtualRepository } from './inventario-atual.repository';
import { CreateInventarioAtualDto } from './dto/create-inventario-atual.dto';
import { UpdateInventarioAtualDto } from './dto/update-inventario-atual.dto';
import { FilterInventarioAtualDto } from './dto/filter-inventario-atual.dto';

export interface InventarioComputado {
  quantidadeTotal: number;
  valorTotalEstoque: number | null;
}

@Injectable()
export class InventarioAtualService {
  constructor(private readonly repository: InventarioAtualRepository) {}

  async create(dto: CreateInventarioAtualDto) {
    try {
      const record = await this.repository.create(dto);
      return this.addComputedFields(record);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        throw new ConflictException(
          'Inventory record for this product, warehouse, and lot already exists',
        );
      }
      throw error;
    }
  }

  async findAll(filters: FilterInventarioAtualDto) {
    const result = await this.repository.findAll(filters);
    return {
      ...result,
      data: result.data.map((item: Record<string, unknown>) =>
        this.addComputedFields(item),
      ),
    };
  }

  async findById(id: string) {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new NotFoundException(
        `Inventario com id ${id} nao encontrado`,
      );
    }
    return this.addComputedFields(record);
  }

  async update(id: string, dto: UpdateInventarioAtualDto) {
    await this.findById(id);
    const record = await this.repository.update(id, dto);
    return this.addComputedFields(record);
  }

  private addComputedFields(
    record: Record<string, unknown>,
  ): Record<string, unknown> & InventarioComputado {
    const disponivel = Number(record.quantidadeDisponivel ?? 0);
    const reservada = Number(record.quantidadeReservada ?? 0);
    const quarentena = Number(record.quantidadeEmQuarentena ?? 0);

    const quantidadeTotal = disponivel + reservada + quarentena;
    const custo = record.custoMedioUnitario
      ? Number(record.custoMedioUnitario)
      : null;
    const valorTotalEstoque = custo !== null ? quantidadeTotal * custo : null;

    return {
      ...record,
      quantidadeTotal,
      valorTotalEstoque,
    };
  }
}
