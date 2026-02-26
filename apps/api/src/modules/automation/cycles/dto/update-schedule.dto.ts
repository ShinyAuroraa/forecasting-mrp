import { IsString, Matches } from 'class-validator';

const CRON_REGEX = /^(\*|[0-9]{1,2})\s+(\*|[0-9]{1,2})\s+(\*|[0-9]{1,2})\s+(\*|[0-9]{1,2})\s+(\*|[0-9]{1,2})$/;

/**
 * DTO for updating cycle schedule cron expressions.
 *
 * @see Story 4.5 — AC-5, AC-6
 */
export class UpdateScheduleDto {
  @IsString()
  @Matches(CRON_REGEX, { message: 'daily must be a valid 5-field cron expression' })
  daily!: string;

  @IsString()
  @Matches(CRON_REGEX, { message: 'weekly must be a valid 5-field cron expression' })
  weekly!: string;

  @IsString()
  @Matches(CRON_REGEX, { message: 'monthly must be a valid 5-field cron expression' })
  monthly!: string;
}
