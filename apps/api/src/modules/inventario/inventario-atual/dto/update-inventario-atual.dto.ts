import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateInventarioAtualDto } from './create-inventario-atual.dto';

export class UpdateInventarioAtualDto extends PartialType(
  OmitType(CreateInventarioAtualDto, ['produtoId', 'depositoId'] as const),
) {}
