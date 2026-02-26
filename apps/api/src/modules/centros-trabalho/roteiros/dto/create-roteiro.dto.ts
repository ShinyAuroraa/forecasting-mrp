import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsInt,
  IsNumber,
  IsOptional,
  IsBoolean,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRoteiroDto {
  @IsUUID()
  @IsNotEmpty()
  produtoId!: string;

  @IsUUID()
  @IsNotEmpty()
  centroTrabalhoId!: string;

  @IsInt()
  @Min(1)
  sequencia!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  operacao!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tempoSetupMinutos?: number;

  @IsNumber()
  @Min(0.0001)
  tempoUnitarioMinutos!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tempoEsperaMinutos?: number;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
