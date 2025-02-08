import { exec } from 'child_process';
import schedule from 'node-schedule';
import { Settings } from '../db/settingsSchema.js';
import logger from '../logger.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { TimeZone } from '../db/timeZones.js';
// import { executeCalibrateSensors } from './calibrateSensors.js';
import { Side } from '../db/schedulesSchema.js';
// import moment from 'moment-timezone';


const scheduleRebootJob = (onHour: number, onMinute: number, timeZone: TimeZone) => {
  const dailyRule = new schedule.RecurrenceRule();
  dailyRule.hour = onHour;
  dailyRule.minute = onMinute;
  dailyRule.tz = timeZone;

  const time = `${String(onHour).padStart(2,'0')}:${String(onMinute).padStart(2,'0')}`
  logger.debug(`Scheduling daily reboot job at ${time}`);
  schedule.scheduleJob(`daily-reboot-${time}`, dailyRule, async () => {
    logger.info(`Executing scheduled reboot job`);
    exec('sudo /sbin/reboot', (error, stdout, stderr) => {
      if (error) {
        logger.error(`Error: ${error.message}`);
        return;
      }
      if (stderr) {
        logger.error(`Stderr: ${stderr}`);
        return;
      }
      logger.debug(`Stdout: ${stdout}`);
    });
  });
}

// const scheduleCalibrationJob = (onHour: number, onMinute: number, timeZone: TimeZone, side: Side) => {
//   const dailyRule = new schedule.RecurrenceRule();
//   dailyRule.hour = onHour;
//   dailyRule.minute = onMinute;
//   dailyRule.tz = timeZone;
//
//   const time = `${String(onHour).padStart(2,'0')}:${String(onMinute).padStart(2,'0')}`
//   logger.debug(`Scheduling daily calibration job at ${time}`);
//   schedule.scheduleJob(`daily-calibration-${time}-${side}`, dailyRule, async () => {
//     logger.info(`Executing scheduled calibration job`);
//     executeCalibrateSensors(side, moment().subtract(6, 'hours').toISOString(), moment().toISOString())
//   });
// }




export const schedulePrimingRebootAndCalibration = (settingsData: Settings) => {
  const { timeZone, primePodDaily } = settingsData;
  if (timeZone === null) return;
  if (!primePodDaily.enabled) return;
  const dailyRule = new schedule.RecurrenceRule();
  const { time } = primePodDaily;
  const [onHour, onMinute] = time.split(':').map(Number);
  dailyRule.hour = onHour;
  dailyRule.minute = onMinute;
  dailyRule.tz = timeZone;

  scheduleRebootJob(onHour - 2, onMinute, timeZone);
  // scheduleCalibrationJob(onHour, 0, timeZone, 'left');
  // scheduleCalibrationJob(onHour, 30, timeZone, 'right');

  logger.debug(`Scheduling daily prime job at ${primePodDaily.time}`);
  schedule.scheduleJob(`daily-priming-${time}`, dailyRule, async () => {
    logger.info(`Executing scheduled prime job`);
    await updateDeviceStatus({ isPriming: true });
  });
};
