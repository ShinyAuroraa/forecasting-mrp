import { IsOptional, IsString } from 'class-validator';

export class DriftCheckQueryDto {
  @IsOptional()
  @IsString()
  tipoModelo?: string;
}
