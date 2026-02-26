import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsEmail,
  IsInt,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { IsCnpj } from '../../../common/validators/cnpj.validator';

export class CreateFornecedorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  codigo!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  razaoSocial!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nomeFantasia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  @IsCnpj()
  cnpj?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  estado?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimePadraoDias?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeMinDias?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeMaxDias?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  confiabilidadePct?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  avaliacao?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
