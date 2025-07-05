import moment from 'moment-timezone';
import schedule from 'node-schedule';
import type { DailySchedule, DayOfWeek, Side } from '../db/schedulesSchema.js';
import type { Settings } from '../db/settingsSchema.js';
import type { TimeZone } from '../db/timeZones.js';
import logger from '../logger.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { executeAnalyzeSleep } from './analyzeSleep.js';
import { getDayIndexForSchedule, getDayOfWeekIndex, logJob } from './utils.js';

export const schedulePowerOn = (
  settingsData: Settings,
  side: Side,
  day: DayOfWeek,
  power: DailySchedule['power'],
) => {
  if (!power.enabled) return;
  if (settingsData[side].awayMode) return;
  if (settingsData.timeZone === null) return;

  const onRule = new schedule.RecurrenceRule();
  const dayOfWeekIndex = getDayOfWeekIndex(day);
  onRule.dayOfWeek = dayOfWeekIndex;
  const [onHour, onMinute] = power.on.split(':').map(Number);
  const time = power.on;
  onRule.hour = onHour;
  onRule.minute = onMinute;
  onRule.tz = settingsData.timeZone;

  logJob('Scheduling power on job', side, day, dayOfWeekIndex, time);
  schedule.scheduleJob(`${side}-${day}-${time}-power-on`, onRule, async () => {
    logJob('Executing power on job', side, day, dayOfWeekIndex, time);

    await updateDeviceStatus({
      [side]: {
        isOn: true,
        targetTemperatureF: power.onTemperature,
      },
    });
  });
};

const scheduleAnalyzeSleep = (
  dayOfWeekIndex: number,
  offHour: number,
  offMinute: number,
  timeZone: TimeZone,
  side: Side,
  day: DayOfWeek,
) => {
  const dailyRule = new schedule.RecurrenceRule();
  const adjustedOffMinute = offMinute;
  dailyRule.dayOfWeek = dayOfWeekIndex;
  dailyRule.hour = offHour;
  dailyRule.minute = adjustedOffMinute;
  dailyRule.tz = timeZone;
  const time = `${String(offHour).padStart(2, '0')}:${String(adjustedOffMinute).padStart(2, '0')}`;

  logger.debug(
    `Scheduling daily sleep analyzer job for ${side} side on ${day} at ${time}`,
  );
  schedule.scheduleJob(
    `daily-analyze-sleep-${time}-${side}`,
    dailyRule,
    async () => {
      logger.info(
        `Executing scheduled calibration job for side ${side} on ${day} at ${time}`,
      );
      // Subtract a fixed start time
      await executeAnalyzeSleep(
        side,
        moment().subtract(12, 'hours').toISOString(),
        moment().add(3, 'hours').toISOString(),
      );
    },
  );
};

export const schedulePowerOffAndSleepAnalysis = (
  settingsData: Settings,
  side: Side,
  day: DayOfWeek,
  power: DailySchedule['power'],
) => {
  if (!power.enabled) return;
  if (settingsData[side].awayMode) return;
  if (settingsData.timeZone === null) return;

  const offRule = new schedule.RecurrenceRule();
  const dayOfWeekIndex = getDayIndexForSchedule(day, power.off);
  offRule.dayOfWeek = dayOfWeekIndex;
  const time = power.off;
  const [offHour, offMinute] = time.split(':').map(Number);
  offRule.hour = offHour;
  offRule.minute = offMinute;
  offRule.tz = settingsData.timeZone;
  scheduleAnalyzeSleep(
    dayOfWeekIndex,
    offHour,
    offMinute,
    settingsData.timeZone,
    side,
    day,
  );
  logJob('Scheduling power off job', side, day, dayOfWeekIndex, time);

  schedule.scheduleJob(
    `${side}-${day}-${time}-power-off`,
    offRule,
    async () => {
      logJob('Executing power off job', side, day, dayOfWeekIndex, time);
      await updateDeviceStatus({
        [side]: {
          isOn: false,
        },
      });
    },
  );
};
