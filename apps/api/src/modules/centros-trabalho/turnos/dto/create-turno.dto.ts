import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsArray,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CreateTurnoDto {
  @IsUUID()
  @IsNotEmpty()
  centroTrabalhoId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nome!: string;

  @IsString()
  @IsNotEmpty()
  horaInicio!: string;

  @IsString()
  @IsNotEmpty()
  horaFim!: string;

  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  diasSemana!: number[];

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsDateString()
  validoDesde?: string;

  @IsOptional()
  @IsDateString()
  validoAte?: string;
}
