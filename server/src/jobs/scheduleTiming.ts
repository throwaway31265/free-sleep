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

type AlarmOwnerSchedule = { power: { on: Time }; alarm: { enabled: boolean } };

/**
 * Schedules are keyed by the night they start on, so a 07:00 alarm on Friday morning belongs
 * to the thursday schedule. Given the calendar day an alarm fires and its time, return the
 * schedule day that owns it: an enabled owner first (previous night before same day), then any
 * owner, then null when no schedule maps to that day/time.
 */
export function getScheduleDayForAlarm<T extends AlarmOwnerSchedule>(
  fireDay: DayOfWeek,
  time: Time,
  sideSchedule: Record<DayOfWeek, T>,
): DayOfWeek | null {
  const fireIndex = getDayOfWeekIndex(fireDay);
  const previousDay = DAYS_OF_WEEK[(fireIndex + DAYS_OF_WEEK.length - 1) % DAYS_OF_WEEK.length] as DayOfWeek;
  const owners = [previousDay, fireDay].filter((day) => {
    const daily = sideSchedule[day];
    return daily && getDayIndexForSchedule(day, time, daily.power.on) === fireIndex;
  });
  return owners.find((day) => sideSchedule[day].alarm.enabled) ?? owners[0] ?? null;
}
