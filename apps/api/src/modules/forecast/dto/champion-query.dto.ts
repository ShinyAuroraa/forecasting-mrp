import { IsOptional, IsString } from 'class-validator';

export class ChampionQueryDto {
  @IsOptional()
  @IsString()
  tipoModelo?: string;
}
