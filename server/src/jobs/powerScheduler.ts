import schedule from 'node-schedule';
import { Settings } from '../db/settingsSchema.js';
import { DailySchedule, DayOfWeek, Side, Time } from '../db/schedulesSchema.js';
import logger from '../logger.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { getDayOfWeekIndex } from './utils.js';
// import { executeAnalyzeSleep } from './analyzeSleep.js';
import { TimeZone } from '../db/timeZones.js';

export const schedulePowerOn = (settingsData: Settings, side: Side, day: DayOfWeek, power: DailySchedule['power']) => {
  if (!power.enabled) return;
  if (settingsData[side].awayMode) return;
  if (settingsData.timeZone === null) return;

  const onRule = new schedule.RecurrenceRule();
  onRule.dayOfWeek = getDayOfWeekIndex(day);
  const [onHour, onMinute] = power.on.split(':').map(Number);
  const time =  power.on;
  onRule.hour = onHour;
  onRule.minute = onMinute;
  onRule.tz = settingsData.timeZone;

  logger.debug(`Scheduling power on for ${side} side on ${day} at ${power.on} at ${power.onTemperature}°F`);
  schedule.scheduleJob(`${side}-${day}-${time}-power-on`, onRule, async () => {
    logger.info(`Executing scheduled power on job for ${side} side on ${day} at ${power.on} at ${power.onTemperature}°F`);
    await updateDeviceStatus({
      [side]: {
        isOn: true,
        targetTemperatureF: power.onTemperature
      }
    });
  });
};

function isEndTimeSameDay(endTime: Time) {
  const endHour = Number(endTime.split(':')[0]);
  return endHour > 11;
}


const scheduleAnalyzeSleep = (dayOfWeek: number, offHour: number, offMinute: number, timeZone: TimeZone, side: Side, day: DayOfWeek) => {
  const dailyRule = new schedule.RecurrenceRule();
  const adjustedOffMinute = offMinute + 15;
  dailyRule.dayOfWeek = dayOfWeek
  dailyRule.hour = offHour;
  dailyRule.minute = adjustedOffMinute;
  dailyRule.tz = timeZone;
  const time = `${String(offHour).padStart(2,'0')}:${String(adjustedOffMinute).padStart(2,'0')}`

  logger.debug(`Scheduling daily sleep analyzer job for ${side} side on ${day} at ${time}`);
  // schedule.scheduleJob(`daily-analyze-sleep-${time}-${side}`, dailyRule, async () => {
  //   logger.info(`Executing scheduled calibration job`);
  //   // Subtract a fixed start time
  //   executeAnalyzeSleep(side, moment().subtract(12, 'hours').toISOString(), moment().add(3, 'hours').toISOString())
  // });
}


export const schedulePowerOffAndSleepAnalysis = (settingsData: Settings, side: Side, day: DayOfWeek, power: DailySchedule['power']) => {
  if (!power.enabled) return;
  if (settingsData[side].awayMode) return;
  if (settingsData.timeZone === null) return;

  const offRule = new schedule.RecurrenceRule();
  // Handle if someone has odd sleeping schedule for w/e reason (goes to bed at 13:00, wakes up at 21:00)
  let dayOfWeek;
  if (isEndTimeSameDay(power.off)) {
    dayOfWeek = getDayOfWeekIndex(day);
  } else {
    dayOfWeek = getDayOfWeekIndex(day) + 1;
  }

  offRule.dayOfWeek = dayOfWeek
  const time = power.off;
  const [offHour, offMinute] = time.split(':').map(Number);
  offRule.hour = offHour;
  offRule.minute = offMinute;
  offRule.tz = settingsData.timeZone;
  scheduleAnalyzeSleep(dayOfWeek, offHour, offMinute, settingsData.timeZone, side, day);
  logger.debug(`Scheduling power off job for ${side} side on ${day} at ${power.off}`);
  schedule.scheduleJob(`${side}-${day}-${time}-power-off`, offRule, async () => {
    logger.info(`Executing scheduled power off job for ${side} side on ${day} at ${power.off}`);
    await updateDeviceStatus({
      [side]: {
        isOn: false,
      }
    });
  });
};


