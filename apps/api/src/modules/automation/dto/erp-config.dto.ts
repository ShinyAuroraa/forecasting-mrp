import {
  IsString,
  IsIn,
  IsOptional,
  IsInt,
  Min,
  Max,
  ValidateNested,
  IsNotEmpty,
  IsObject,
  IsUrl,
  IsDateString,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';

@ValidatorConstraint({ name: 'fallbackDiffersFromTipo', async: false })
class FallbackDiffersFromTipo implements ValidatorConstraintInterface {
  validate(fallback: string, args: ValidationArguments) {
    const obj = args.object as { tipo?: string };
    return !fallback || fallback !== obj.tipo;
  }

  defaultMessage() {
    return 'Fallback connector must differ from primary connector type';
  }
}

export class RestAuthDto {
  @IsIn(['apiKey', 'bearer', 'basic'])
  type!: 'apiKey' | 'bearer' | 'basic';

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  headerName?: string;

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;
}

export class RestConnectorConfigDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;

  @ValidateNested()
  @Type(() => RestAuthDto)
  auth!: RestAuthDto;

  @IsOptional()
  @IsObject()
  queryParams?: Record<string, string>;

  @IsIn(['JSON', 'XML'])
  responseFormat!: 'JSON' | 'XML';

  @IsOptional()
  @IsString()
  dataPath?: string;
}

export class DbConnectorConfigDto {
  @IsString()
  @IsNotEmpty()
  connectionString!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\s*SELECT\s/i, { message: 'Query must be a SELECT statement (read-only)' })
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  maxConnections: number = 5;
}

export class SftpConnectorConfigDto {
  @IsString()
  @IsNotEmpty()
  host!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port: number = 22;

  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  privateKey?: string;

  @IsString()
  @IsNotEmpty()
  remotePath!: string;

  @IsString()
  @IsNotEmpty()
  filePattern!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  pollIntervalMinutes: number = 60;
}

export class UpdateErpConfigDto {
  @IsIn(['REST', 'DB', 'SFTP'])
  tipo!: 'REST' | 'DB' | 'SFTP';

  @IsOptional()
  @IsIn(['REST', 'DB', 'SFTP'])
  @Validate(FallbackDiffersFromTipo)
  fallback?: 'REST' | 'DB' | 'SFTP';

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsIn(['diario', 'semanal', 'mensal'])
  granularidade?: 'diario' | 'semanal' | 'mensal';

  @IsOptional()
  @ValidateNested()
  @Type(() => RestConnectorConfigDto)
  rest?: RestConnectorConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DbConnectorConfigDto)
  db?: DbConnectorConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SftpConnectorConfigDto)
  sftp?: SftpConnectorConfigDto;
}

export class TestConnectionDto {
  @IsOptional()
  @IsIn(['REST', 'DB', 'SFTP'])
  tipo?: 'REST' | 'DB' | 'SFTP';
}

export class FetchDailyDataDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}
