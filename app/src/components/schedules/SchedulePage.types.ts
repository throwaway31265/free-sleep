import type { DayOfWeek } from '@api/schedulesSchema';

export type DaysSelected = Record<DayOfWeek, boolean>;

export type AccordionExpanded =
  | undefined
  | 'applyToDays'
  | 'temperatureAdjustments'
  | 'elevationAdjustments'
  | 'alarm';
