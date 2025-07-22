import schedule from 'node-schedule';

import type {
  DailySchedule,
  DayOfWeek,
  Side,
  Time,
} from '../db/schedulesSchema.js';
import type { Settings } from '../db/settingsSchema.js';
import type { TimeZone } from '../db/timeZones.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { getDayIndexForSchedule, logJob } from './utils.js';

const scheduleAdjustment = (
  timeZone: TimeZone,
  side: Side,
  day: DayOfWeek,
  time: Time,
  temperature: number,
) => {
  const onRule = new schedule.RecurrenceRule();

  const dayOfWeekIndex = getDayIndexForSchedule(day, time);
  const [onHour, onMinute] = time.split(':').map(Number);
  logJob(
    'Scheduling temperature adjustment job',
    side,
    day,
    dayOfWeekIndex,
    time,
  );

  onRule.dayOfWeek = dayOfWeekIndex;
  onRule.hour = onHour;
  onRule.minute = onMinute;
  onRule.tz = timeZone;

  schedule.scheduleJob(
    `${side}-${day}-${time}-${temperature}-temperature-adjustment`,
    onRule,
    async () => {
      logJob(
        'Executing temperature adjustment job',
        side,
        day,
        dayOfWeekIndex,
        time,
      );
      await updateDeviceStatus({
        [side]: {
          targetTemperatureF: temperature,
        },
      });
    },
  );
};

export const scheduleTemperatures = (
  settingsData: Settings,
  side: Side,
  day: DayOfWeek,
  temperatures: DailySchedule['temperatures'],
) => {
  if (settingsData[side].awayMode) return;
  const { timeZone } = settingsData;
  if (timeZone === null) return;

  Object.entries(temperatures).forEach(([time, temperature]) => {
    scheduleAdjustment(timeZone, side, day, time, temperature);
  });
};
