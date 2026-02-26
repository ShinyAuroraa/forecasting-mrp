import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

class ClassMultipliersDto {
  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  readonly A!: number;

  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  readonly B!: number;

  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  readonly C!: number;
}

class SkuOverrideDto {
  @IsString()
  @IsNotEmpty()
  readonly produtoId!: string;

  @IsArray()
  @ArrayMaxSize(104)
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(1_000_000, { each: true })
  readonly weeklyDemand!: readonly number[];
}

class ScenarioAdjustmentDto {
  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  readonly globalMultiplier!: number;

  @ValidateNested()
  @Type(() => ClassMultipliersDto)
  readonly classMultipliers!: ClassMultipliersDto;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SkuOverrideDto)
  @IsOptional()
  readonly skuOverrides?: readonly SkuOverrideDto[];
}

/**
 * DTO for creating a What-If scenario.
 *
 * @see Story 4.9 — AC-1, AC-2, AC-3, AC-4, AC-5
 */
export class CreateScenarioDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  readonly name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly description?: string;

  @ValidateNested()
  @Type(() => ScenarioAdjustmentDto)
  readonly adjustments!: ScenarioAdjustmentDto;
}
