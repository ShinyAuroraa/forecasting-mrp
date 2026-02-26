import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  IsIn,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ColumnMappingDto {
  @IsString()
  @IsNotEmpty()
  sourceColumn!: string;

  @IsString()
  @IsNotEmpty()
  targetField!: string;

  @IsIn(['string', 'number', 'date', 'boolean'])
  dataType!: 'string' | 'number' | 'date' | 'boolean';

  @IsOptional()
  @IsString()
  transformation?: string;

  @IsBoolean()
  required!: boolean;
}

export class CreateMappingTemplateDto {
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsEnum(['CSV', 'XLSX', 'API', 'DB'])
  tipoFonte!: 'CSV' | 'XLSX' | 'API' | 'DB';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnMappingDto)
  colunas!: ColumnMappingDto[];

  @IsOptional()
  @IsArray()
  validationRules?: Record<string, unknown>[];
}
