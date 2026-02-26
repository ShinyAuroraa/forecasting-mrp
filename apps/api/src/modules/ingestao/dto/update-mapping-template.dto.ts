import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ColumnMappingDto } from './create-mapping-template.dto';

export class UpdateMappingTemplateDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsEnum(['CSV', 'XLSX', 'API', 'DB'])
  tipoFonte?: 'CSV' | 'XLSX' | 'API' | 'DB';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnMappingDto)
  colunas?: ColumnMappingDto[];

  @IsOptional()
  @IsArray()
  validationRules?: Record<string, unknown>[];
}
