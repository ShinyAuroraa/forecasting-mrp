import {
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsDateString,
  IsUUID,
  Min,
} from 'class-validator';

export class RecordLeadTimeDto {
  @IsUUID()
  @IsNotEmpty()
  produtoFornecedorId!: string;

  @IsInt()
  @Min(1)
  leadTimeRealDias!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimePlanejadoDias?: number;

  @IsDateString()
  dataEntrega!: string;

  @IsOptional()
  @IsString()
  pedidoRef?: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}
