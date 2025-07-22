import schedule from 'node-schedule';
import { BASE_PRESETS } from '../8sleep/basePresets.js';
import { trimixBase } from '../8sleep/trimixBaseControl.js';
import type {
  BaseElevation,
  DailySchedule,
  DayOfWeek,
  Side,
  Time,
} from '../db/schedulesSchema.js';
import type { Settings } from '../db/settingsSchema.js';
import type { TimeZone } from '../db/timeZones.js';
import logger from '../logger.js';
import { getDayIndexForSchedule, logJob } from './utils.js';

const scheduleElevation = (
  timeZone: TimeZone,
  side: Side,
  day: DayOfWeek,
  time: Time,
  elevation: BaseElevation,
) => {
  const rule = new schedule.RecurrenceRule();

  const dayOfWeekIndex = getDayIndexForSchedule(day, time);
  const [hour, minute] = time.split(':').map(Number);
  logJob('Scheduling base elevation job', side, day, dayOfWeekIndex, time);

  rule.dayOfWeek = dayOfWeekIndex;
  rule.hour = hour;
  rule.minute = minute;
  rule.tz = timeZone;

  schedule.scheduleJob(
    `${side}-${day}-${time}-base-elevation`,
    rule,
    async () => {
      logJob('Executing base elevation job', side, day, dayOfWeekIndex, time);

      try {
        // Check if elevation is a preset or custom position
        if ('preset' in elevation) {
          const position = BASE_PRESETS[elevation.preset];
          logger.info(
            `Setting base to ${elevation.preset} preset for ${side} side:`,
            position,
          );
          await trimixBase.setPosition({
            head: position.head,
            feet: position.feet,
            feedRate: position.feedRate || 50,
          });
        } else {
          logger.info(
            `Setting base to custom position for ${side} side:`,
            elevation,
          );
          await trimixBase.setPosition({
            head: elevation.head,
            feet: elevation.feet,
            feedRate: elevation.feedRate || 50,
          });
        }
      } catch (error) {
        logger.error('Error executing base elevation job:', error);
      }
    },
  );
};

export const scheduleElevations = (
  settingsData: Settings,
  side: Side,
  day: DayOfWeek,
  elevations: DailySchedule['elevations'],
) => {
  if (settingsData[side].awayMode) return;
  const { timeZone } = settingsData;
  if (timeZone === null) return;

  Object.entries(elevations).forEach(([time, elevation]) => {
    scheduleElevation(timeZone, side, day, time, elevation);
  });
};
