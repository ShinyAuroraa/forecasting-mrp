import { IsString, IsNumber, IsBoolean, IsArray, IsOptional, IsEmail, Min, Max } from 'class-validator';

/**
 * DTO for updating SMTP configuration + email recipients.
 *
 * @see Story 4.7 — AC-15
 */
export class UpdateEmailConfigDto {
  @IsString()
  readonly host!: string;

  @IsNumber()
  @Min(1)
  @Max(65535)
  readonly port!: number;

  @IsBoolean()
  readonly secure!: boolean;

  @IsString()
  readonly user!: string;

  @IsString()
  readonly pass!: string;

  @IsEmail()
  readonly fromAddress!: string;

  @IsString()
  readonly fromName!: string;

  @IsArray()
  @IsEmail({}, { each: true })
  readonly summaryRecipients!: string[];

  @IsArray()
  @IsEmail({}, { each: true })
  readonly briefingRecipients!: string[];

  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  readonly cc?: string[];

  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  readonly bcc?: string[];
}
