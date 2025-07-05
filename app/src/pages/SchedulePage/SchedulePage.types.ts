import type { DayOfWeek } from '@api/schedulesSchema.ts';

export type DaysSelected = Record<DayOfWeek, boolean>;

export type AccordionExpanded =
  | undefined
  | 'applyToDays'
  | 'temperatureAdjustments'
  | 'alarm';
