import schedule from 'node-schedule';
import { Settings } from '../db/settingsSchema.js';
import { DailySchedule, DayOfWeek, Side } from '../db/schedulesSchema.js';
import memoryDB from '../db/memoryDB.js';
import { getDayIndexForSchedule, logJob } from './utils.js';
import cbor from 'cbor';
import moment from 'moment-timezone';
import { executeFunction } from '../8sleep/deviceApi.js';
import { getFranken } from '../8sleep/frankenServer.js';
import serverStatus from '../serverStatus.js';
import logger from '../logger.js';




export const scheduleAlarm = (settingsData: Settings, side: Side, day: DayOfWeek, dailySchedule: DailySchedule) => {
  if (!dailySchedule.power.enabled) return;
  if (!dailySchedule.alarm.enabled) return;
  if (settingsData[side].awayMode) return;
  if (settingsData.timeZone === null) return;

  const alarmRule = new schedule.RecurrenceRule();

  const dayIndex = getDayIndexForSchedule(day, dailySchedule.power.off);
  alarmRule.dayOfWeek = dayIndex;

  const { time } = dailySchedule.alarm;
  const [alarmHour, alarmMinute] = time.split(':').map(Number);
  alarmRule.hour = alarmHour;
  alarmRule.minute = alarmMinute;
  alarmRule.tz = settingsData.timeZone;

  logJob('Scheduling alarm job', side, day, dayIndex, time);

  schedule.scheduleJob(`${side}-${day}-${time}-alarm`, alarmRule, async () => {
    try {

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const currentTime = moment.tz(settingsData.timeZone!);
      const alarmTimeEpoch = currentTime.unix();

      const alarmPayload = {
        pl: dailySchedule.alarm.vibrationIntensity,
        du: dailySchedule.alarm.duration,
        pi: dailySchedule.alarm.vibrationPattern,
        tt: alarmTimeEpoch,
      };

      const cborPayload = cbor.encode(alarmPayload);
      const hexPayload = cborPayload.toString('hex');
      const command = side === 'left' ? 'ALARM_LEFT' : 'ALARM_RIGHT';
      const franken = await getFranken();
      const resp = await franken.getDeviceStatus();
      if (!resp[side].isOn) {
        logJob('Skipping scheduled alarm, pod is off', side, day, dayIndex, time);
        return;
      }
      logJob('Executing alarm job', side, day, dayIndex, time);

      await executeFunction(command, hexPayload);
      await memoryDB.read();
      memoryDB.data[side].isAlarmVibrating = true;
      await memoryDB.write();

      setTimeout(
        async () => {
          logJob('Clearing alarm job', side, day, dayIndex, time);
          await memoryDB.read();
          memoryDB.data[side].isAlarmVibrating = false;
          await memoryDB.write();
        },
        dailySchedule.alarm.duration * 1_000
      );
      serverStatus.alarmSchedule.status = 'healthy';
      serverStatus.alarmSchedule.message = '';
    } catch (error: unknown) {
      serverStatus.alarmSchedule.status = 'failed';
      const message = error instanceof Error ? error.message : String(error);
      serverStatus.alarmSchedule.message = message;
      logger.error(error);
    }
  });
};


