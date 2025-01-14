import chokidar from 'chokidar';
import moment from 'moment-timezone';
import schedule from 'node-schedule';
import logger from '../logger.js';
import schedulesDB from '../db/schedules.js';
import settingsDB from '../db/settings.js';
import { DayOfWeek, Side } from '../db/schedulesSchema.js';
import { schedulePowerOff, schedulePowerOn } from './powerScheduler.js';
import { scheduleTemperatures } from './temperatureScheduler.js';
import { schedulePriming } from './primeScheduler.js';
import { scheduleAnalysis } from './analysisScheduler.js';
import config from '../config.js';
import { scheduleAlarm } from './alarmScheduler.js';


async function setupJobs() {
  logger.info('Scheduling jobs...');

  // Clear existing jobs
  logger.info('Canceling old jobs...');
  Object.keys(schedule.scheduledJobs).forEach((jobName) => {
    logger.debug(`Canceled job: ${jobName}`);
    schedule.cancelJob(jobName);
  });
  await schedule.gracefulShutdown();

  await settingsDB.read();
  await schedulesDB.read();

  moment.tz.setDefault(settingsDB.data.timeZone || 'UTC');

  const schedulesData = schedulesDB.data;
  const settingsData = settingsDB.data;

  Object.entries(schedulesData).forEach(([side, sideSchedule]) => {
    Object.entries(sideSchedule).forEach(([day, schedule]) => {
      schedulePowerOn(settingsData, side as Side, day as DayOfWeek, schedule.power);
      schedulePowerOff(settingsData, side as Side, day as DayOfWeek, schedule.power);
      scheduleTemperatures(settingsData, side as Side, day as DayOfWeek, schedule.temperatures);
      scheduleAlarm(settingsData, side as Side, day as DayOfWeek, schedule);
    });
  });
  schedulePriming(settingsData);
  scheduleAnalysis(settingsData);

  logger.info('Done scheduling jobs!');
}


// Monitor the JSON file and refresh jobs on change
chokidar.watch(config.dbFolder).on('change', () => {
  logger.debug('Detected DB change, reloading...');
  setupJobs();
});

// Initial job setup
await setupJobs();
