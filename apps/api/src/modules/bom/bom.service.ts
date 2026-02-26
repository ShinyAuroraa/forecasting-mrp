import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BomRepository } from './bom.repository';
import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';
import { FilterBomDto } from './dto/filter-bom.dto';

export interface BomTreeNode {
  bomId?: string;
  produtoId: string;
  codigo: string;
  descricao: string;
  quantidade?: number;
  perdaPercentual?: number;
  custoUnitario?: number;
  children: BomTreeNode[];
}

export interface ExplodedCostResult {
  produtoId: string;
  codigo: string;
  descricao: string;
  totalCost: number;
  components: ExplodedCostLine[];
}

export interface ExplodedCostLine {
  produtoId: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  perdaPercentual: number;
  custoUnitario: number;
  lineCost: number;
  level: number;
}

@Injectable()
export class BomService {
  constructor(private readonly repository: BomRepository) {}

  async create(dto: CreateBomDto) {
    if (dto.produtoPaiId === dto.produtoFilhoId) {
      throw new BadRequestException(
        'A product cannot be a component of itself',
      );
    }

    const hasCircular = await this.detectCircularReference(
      dto.produtoPaiId,
      dto.produtoFilhoId,
    );
    if (hasCircular) {
      throw new BadRequestException(
        'Circular reference detected: this would create a cycle in the BOM',
      );
    }

    return this.repository.create(dto);
  }

  async findAll(filters: FilterBomDto) {
    return this.repository.findAll(filters);
  }

  async findById(id: string) {
    const bom = await this.repository.findById(id);
    if (!bom) {
      throw new NotFoundException(`BOM com id ${id} nao encontrado`);
    }
    return bom;
  }

  async update(id: string, dto: UpdateBomDto) {
    await this.findById(id);
    return this.repository.update(id, dto);
  }

  async remove(id: string) {
    await this.findById(id);
    await this.repository.softDelete(id);
  }

  async buildTree(produtoId: string): Promise<BomTreeNode> {
    const bomLines = await this.repository.findByProdutoPaiId(produtoId);

    if (bomLines.length === 0) {
      // Return a leaf node — find the product info from the first BOM line or DB
      return {
        produtoId,
        codigo: '',
        descricao: '',
        children: [],
      };
    }

    const firstLine = bomLines[0];
    const parentProduct = (firstLine as any).produtoPai ?? {
      codigo: '',
      descricao: '',
    };

    const children: BomTreeNode[] = [];
    for (const line of bomLines) {
      const child = (line as any).produtoFilho;
      const childTree = await this.buildTree(child.id);
      children.push({
        bomId: line.id,
        produtoId: child.id,
        codigo: child.codigo,
        descricao: child.descricao,
        quantidade: Number(line.quantidade),
        perdaPercentual: Number(line.perdaPercentual ?? 0),
        custoUnitario: child.custoUnitario
          ? Number(child.custoUnitario)
          : undefined,
        children: childTree.children,
      });
    }

    return {
      produtoId,
      codigo: parentProduct.codigo ?? '',
      descricao: parentProduct.descricao ?? '',
      children,
    };
  }

  async calculateExplodedCost(produtoId: string): Promise<ExplodedCostResult> {
    const components: ExplodedCostLine[] = [];
    await this.collectCostLines(produtoId, 1, 1, components);

    const totalCost = components.reduce((sum, c) => sum + c.lineCost, 0);

    // Get root product info
    const rootBomLines = await this.repository.findByProdutoPaiId(produtoId);
    let codigo = '';
    let descricao = '';
    if (rootBomLines.length > 0) {
      const parent = (rootBomLines[0] as any).produtoPai;
      if (parent) {
        codigo = parent.codigo ?? '';
        descricao = parent.descricao ?? '';
      }
    }

    return {
      produtoId,
      codigo,
      descricao,
      totalCost: Math.round(totalCost * 100) / 100,
      components,
    };
  }

  private async collectCostLines(
    produtoId: string,
    parentQty: number,
    level: number,
    components: ExplodedCostLine[],
  ): Promise<void> {
    const bomLines = await this.repository.findByProdutoPaiId(produtoId);

    for (const line of bomLines) {
      const child = (line as any).produtoFilho;
      const quantidade = Number(line.quantidade);
      const perdaPercentual = Number(line.perdaPercentual ?? 0);
      const custoUnitario = child.custoUnitario
        ? Number(child.custoUnitario)
        : 0;

      const effectiveQty = quantidade * parentQty;
      const lineCost =
        custoUnitario * effectiveQty * (1 + perdaPercentual / 100);

      components.push({
        produtoId: child.id,
        codigo: child.codigo,
        descricao: child.descricao,
        quantidade: effectiveQty,
        perdaPercentual,
        custoUnitario,
        lineCost: Math.round(lineCost * 100) / 100,
        level,
      });

      // Recurse into sub-components
      await this.collectCostLines(
        child.id,
        effectiveQty,
        level + 1,
        components,
      );
    }
  }

  private async detectCircularReference(
    parentId: string,
    childId: string,
  ): Promise<boolean> {
    // Check if parentId appears as a descendant of childId
    const visited = new Set<string>();
    return this.hasAncestor(childId, parentId, visited);
  }

  private async hasAncestor(
    productId: string,
    targetId: string,
    visited: Set<string>,
  ): Promise<boolean> {
    if (visited.has(productId)) return false;
    visited.add(productId);

    const bomLines = await this.repository.findByProdutoPaiId(productId);

    for (const line of bomLines) {
      const child = (line as any).produtoFilho;
      if (child.id === targetId) return true;
      const found = await this.hasAncestor(child.id, targetId, visited);
      if (found) return true;
    }

    return false;
  }
}
