import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateProdutoFornecedorDto } from './create-produto-fornecedor.dto';

export class UpdateProdutoFornecedorDto extends PartialType(
  OmitType(CreateProdutoFornecedorDto, ['produtoId', 'fornecedorId']),
) {}
