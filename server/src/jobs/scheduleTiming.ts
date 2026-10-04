import type { DayOfWeek, Time } from '../db/schedulesSchema.js';

export const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function getDayOfWeekIndex(day: DayOfWeek): number {
  return DAYS_OF_WEEK.indexOf(day);
}

// Times before power-on belong to the following day, including after noon.
export function getDayIndexForSchedule(scheduleDay: DayOfWeek, time: Time, powerOnTime: Time): number {
  const dayIndex = getDayOfWeekIndex(scheduleDay);
  return time < powerOnTime ? (dayIndex + 1) % DAYS_OF_WEEK.length : dayIndex;
}
