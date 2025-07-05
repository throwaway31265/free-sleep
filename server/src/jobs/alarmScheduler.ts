import { Settings } from '../db/settingsSchema.js';
import { DailySchedule, DayOfWeek, Side } from '../db/schedulesSchema.js';
import logger from '../logger.js';
import cbor from 'cbor';
import moment from 'moment-timezone';
import { executeFunction } from '../8sleep/deviceApi.js';

export const scheduleAlarm = (
  settingsData: Settings,
  side: Side,
  day: DayOfWeek,
  dailySchedule: DailySchedule,
) => {
  if (!dailySchedule.power.enabled || !dailySchedule.alarm.enabled) return;
  if (settingsData[side].awayMode || !settingsData.timeZone) return;

  // Get current time in the correct timezone
  const now = moment.tz(settingsData.timeZone);
  const currentDay = now.format('dddd').toLowerCase() as DayOfWeek;

  // Only schedule if this is today's schedule
  if (day !== currentDay) {
    // logger.debug(`[scheduleAlarm] Skipping ${side} alarm for ${day} as it's not today (${currentDay})`);
    return;
  }

  // Create the target alarm time for today
  const alarmMoment = moment.tz(
    dailySchedule.alarm.time,
    'HH:mm',
    settingsData.timeZone,
  );

  // If the alarm time has passed for today, schedule it for tomorrow
  if (alarmMoment.isBefore(now)) {
    alarmMoment.add(1, 'day');
    logger.debug(
      `[scheduleAlarm] Alarm time already passed, scheduling for tomorrow`,
    );
  }

  logger.debug(
    `[scheduleAlarm] Scheduling ${side} alarm for ${side} on ${day} (${JSON.stringify(dailySchedule)})`,
  );
  logger.debug(`[scheduleAlarm] Alarm time will be: ${alarmMoment.format()}`);

  const alarmPayload = {
    pl: dailySchedule.alarm.vibrationIntensity,
    du: dailySchedule.alarm.duration,
    pi: dailySchedule.alarm.vibrationPattern,
    tt: alarmMoment.unix(), // Future timestamp instead of current time
  };

  const command = side === 'left' ? 'ALARM_LEFT' : 'ALARM_RIGHT';
  const hexPayload = cbor.encode(alarmPayload).toString('hex');

  logger.debug(
    `[scheduleAlarm] Alarm Command: ${command} | Payload: ${JSON.stringify(alarmPayload)}`,
  );

  // Immediate command execution with future timestamp
  executeFunction(command, hexPayload).then(() => {
    logger.info(
      `Scheduled ${side} alarm for ${day} at ${dailySchedule.alarm.time} via device command`,
    );
  });
};
