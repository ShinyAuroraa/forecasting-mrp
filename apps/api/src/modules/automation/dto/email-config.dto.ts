import {
  IsString,
  IsIn,
  IsOptional,
  IsInt,
  Min,
  Max,
  ValidateNested,
  IsNotEmpty,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GmailConfigDto {
  @IsString() @IsNotEmpty() clientId!: string;
  @IsString() @IsNotEmpty() clientSecret!: string;
  @IsString() @IsNotEmpty() refreshToken!: string;
}

export class ImapConfigDto {
  @IsString() @IsNotEmpty() host!: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) port: number = 993;
  @IsString() @IsNotEmpty() username!: string;
  @IsString() @IsNotEmpty() password!: string;
  @IsOptional() @IsBoolean() tls: boolean = true;
}

export class EmailSftpConfigDto {
  @IsString() @IsNotEmpty() host!: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) port: number = 22;
  @IsString() @IsNotEmpty() username!: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsString() privateKey?: string;
  @IsString() @IsNotEmpty() remotePath!: string;
  @IsString() @IsNotEmpty() filePattern!: string;
}

export class EmailFiltersDto {
  @IsOptional() @IsString() sender?: string;
  @IsOptional() @IsString() subjectPattern?: string;
  @IsOptional() @IsBoolean() hasAttachment?: boolean;
}

export class UpdateEmailConfigDto {
  @IsIn(['GMAIL', 'IMAP', 'SFTP'])
  adapterType!: 'GMAIL' | 'IMAP' | 'SFTP';

  @IsOptional() @ValidateNested() @Type(() => GmailConfigDto)
  gmail?: GmailConfigDto;

  @IsOptional() @ValidateNested() @Type(() => ImapConfigDto)
  imap?: ImapConfigDto;

  @IsOptional() @ValidateNested() @Type(() => EmailSftpConfigDto)
  sftp?: EmailSftpConfigDto;

  @ValidateNested() @Type(() => EmailFiltersDto)
  filters!: EmailFiltersDto;

  @IsOptional()
  @IsString()
  @Matches(/^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$/, {
    message: 'Must be a valid cron expression (e.g., "0 6 * * *")',
  })
  cronExpression: string = '0 6 * * *';

  @IsOptional() @IsString() templateId?: string;

  @IsOptional() @IsInt() @Min(1) @Max(50)
  maxAttachmentSizeMb: number = 25;

  @IsOptional() @IsArray() @ArrayMinSize(1) @IsString({ each: true })
  allowedExtensions: string[] = ['.csv', '.xlsx', '.pdf'];
}
