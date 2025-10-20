import type { DailySchedule, Time } from '@api/schedulesSchema';
import moment from 'moment-timezone';

export function parseTimeToMinutes(time: Time): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function isScheduleCurrentlyRunning(
  schedule: DailySchedule | undefined,
  timezone: string | null,
): boolean {
  if (!schedule || !schedule.power.enabled) {
    return false;
  }

  const now = moment.tz(timezone || 'UTC');
  const currentMinutes = now.hours() * 60 + now.minutes();

  const onMinutes = parseTimeToMinutes(schedule.power.on);
  const offMinutes = parseTimeToMinutes(schedule.power.off);

  if (onMinutes < offMinutes) {
    return currentMinutes >= onMinutes && currentMinutes < offMinutes;
  } else {
    return currentMinutes >= onMinutes || currentMinutes < offMinutes;
  }
}

export interface ScheduleStartInfo {
  minutesUntilStart: number;
  startTime: Time;
  isToday: boolean;
}

export function getTimeUntilScheduleStarts(
  schedule: DailySchedule | undefined,
  timezone: string | null,
): ScheduleStartInfo | null {
  if (!schedule || !schedule.power.enabled) {
    return null;
  }

  const now = moment.tz(timezone || 'UTC');
  const currentMinutes = now.hours() * 60 + now.minutes();
  const startMinutes = parseTimeToMinutes(schedule.power.on);

  let minutesUntilStart: number;
  let isToday = true;

  if (startMinutes > currentMinutes) {
    minutesUntilStart = startMinutes - currentMinutes;
  } else {
    minutesUntilStart = 24 * 60 - currentMinutes + startMinutes;
    isToday = false;
  }

  return {
    minutesUntilStart,
    startTime: schedule.power.on,
    isToday,
  };
}

export function formatCountdown(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }

  return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'}`;
}

export function formatTime12Hour(time: Time): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}
