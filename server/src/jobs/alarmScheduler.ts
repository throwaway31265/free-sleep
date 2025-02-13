import { Settings } from '../db/settingsSchema.js';
import { DailySchedule, DayOfWeek, Side, Time } from '../db/schedulesSchema.js';
import logger from '../logger.js';
import { getDayOfWeekIndex } from './utils.js';
import cbor from 'cbor';
import moment from 'moment-timezone';
import { executeFunction } from '../8sleep/deviceApi.js';

export const scheduleAlarm = (settingsData: Settings, side: Side, day: DayOfWeek, dailySchedule: DailySchedule) => {
  if (!dailySchedule.power.enabled || !dailySchedule.alarm.enabled) return;
  if (settingsData[side].awayMode || !settingsData.timeZone) return;

  // Calculate future timestamp for scheduled alarm
  const alarmMoment = moment.tz(dailySchedule.alarm.time, 'HH:mm', settingsData.timeZone)
    .day(getDayOfWeekIndex(day) + 1); // +1 because moment uses 0-6 for Sunday-Saturday

  logger.debug(`[scheduleAlarm] Scheduling ${side} alarm for ${side} on ${day} (${JSON.stringify(dailySchedule)})`);

  const alarmPayload = {
    pl: dailySchedule.alarm.vibrationIntensity,
    du: dailySchedule.alarm.duration,
    pi: dailySchedule.alarm.vibrationPattern,
    tt: alarmMoment.unix(), // Future timestamp instead of current time
  };

  const command = side === 'left' ? 'ALARM_LEFT' : 'ALARM_RIGHT';
  const hexPayload = cbor.encode(alarmPayload).toString('hex');

  logger.debug(`[scheduleAlarm] Alarm Command: ${command} | Payload: ${JSON.stringify(alarmPayload)}`);

  // Immediate command execution with future timestamp
  executeFunction(command, hexPayload).then(() => {
    logger.info(`Scheduled ${side} alarm for ${day} at ${dailySchedule.alarm.time} via device command`);
  });
};


