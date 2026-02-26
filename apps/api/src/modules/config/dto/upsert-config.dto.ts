import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertConfigDto {
  @IsNotEmpty()
  valor!: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;
}
