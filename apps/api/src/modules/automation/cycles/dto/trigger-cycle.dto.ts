import { IsIn } from 'class-validator';

import type { CycleType } from '../cycle.types';

/**
 * DTO for manually triggering a cycle execution.
 *
 * @see Story 4.5 — AC-10
 */
export class TriggerCycleDto {
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY', 'MANUAL'])
  type!: CycleType;
}
