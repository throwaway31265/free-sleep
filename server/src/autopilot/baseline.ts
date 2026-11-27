// Schedule-derived timing for autopilot (current night, wake time). Pure: no I/O.
import moment from 'moment-timezone';
import type { Settings } from '../db/settingsSchema.js';
import type { DailySchedule, DayOfWeek, Schedules, Side, Time } from '../db/schedulesSchema.js';
import { DAYS_OF_WEEK } from '../jobs/scheduleTiming.js';

export type NightInfo = {
  schedule: DailySchedule;
  powerOnMs: number;
  nightDay: moment.Moment; // start of the local day the night's power-on belongs to
};

// HH:mm on a given local day, resolved in the time zone (DST gaps shift forward)
function atLocalTime(day: moment.Moment, time: Time, timeZone: string): moment.Moment {
  return moment.tz(`${day.format('YYYY-MM-DD')} ${time}`, 'YYYY-MM-DD HH:mm', timeZone);
}

/**
 * The current night is the schedule day whose power.on time most recently passed:
 * today if today's power.on is already behind us, otherwise yesterday.
 */
export function getCurrentNight(side: Side, settings: Settings, schedules: Schedules, now: number): NightInfo | null {
  const timeZone = settings.timeZone;
  const nowLocal = moment.tz(now, timeZone);
  for (const daysBack of [0, 1]) {
    const nightDay = nowLocal.clone().subtract(daysBack, 'day').startOf('day');
    const dayKey = DAYS_OF_WEEK[nightDay.day()] as DayOfWeek;
    const schedule = schedules[side]?.[dayKey];
    if (!schedule) continue;
    const powerOn = atLocalTime(nightDay, schedule.power.on, timeZone);
    if (powerOn.valueOf() <= now) {
      return { schedule, powerOnMs: powerOn.valueOf(), nightDay };
    }
  }
  return null;
}

// Wake time picks the alarm override, then the scheduled alarm, then power.off
function pickWakeTime(side: Side, settings: Settings, schedule: DailySchedule, now: number): Time {
  const override = settings[side].scheduleOverrides.alarm;
  const overrideActive = override.expiresAt !== '' && moment.tz(override.expiresAt, settings.timeZone).valueOf() > now;
  if (overrideActive) {
    // A disabled override skips tonight's alarm, so the night ends at power-off
    if (override.disabled) return schedule.power.off;
    if (override.timeOverride) return override.timeOverride;
  }
  if (schedule.alarm.enabled) return schedule.alarm.time;
  return schedule.power.off;
}

/**
 * Epoch ms of this night's wake time, or null when power scheduling is disabled.
 * Times earlier than power.on belong to the next day (same rule as scheduleTiming.ts).
 */
export function getWakeTime(side: Side, settings: Settings, schedules: Schedules, now: number): number | null {
  const night = getCurrentNight(side, settings, schedules, now);
  if (!night?.schedule.power.enabled) return null;
  const wakeTime = pickWakeTime(side, settings, night.schedule, now);
  const wakeDay = wakeTime < night.schedule.power.on ? night.nightDay.clone().add(1, 'day') : night.nightDay;
  return atLocalTime(wakeDay, wakeTime, settings.timeZone).valueOf();
}
