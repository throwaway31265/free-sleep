import chokidar from 'chokidar';
import moment from 'moment-timezone';
import schedule from 'node-schedule';
import config from '../config.js';
import schedulesDB from '../db/schedules.js';
import type { DayOfWeek, Side } from '../db/schedulesSchema.js';
import settingsDB from '../db/settings.js';
import logger from '../logger.js';
import { scheduleAlarm } from './alarmScheduler.js';
import { scheduleElevations } from './baseScheduler.js';
import {
  schedulePowerOffAndSleepAnalysis,
  schedulePowerOn,
} from './powerScheduler.js';
import { schedulePrimingRebootAndCalibration } from './primeScheduler.js';
import { scheduleTemperatures } from './temperatureScheduler.js';

const isJobSetupRunning = false;

async function setupJobs() {
  if (isJobSetupRunning) {
    logger.debug('Job setup already running, skipping duplicate execution.');
    return;
  }

  // Clear existing jobs
  logger.info('Canceling old jobs...');
  Object.keys(schedule.scheduledJobs).forEach((jobName) => {
    schedule.cancelJob(jobName);
  });
  await schedule.gracefulShutdown();

  await settingsDB.read();
  await schedulesDB.read();

  moment.tz.setDefault(settingsDB.data.timeZone || 'UTC');

  const schedulesData = schedulesDB.data;
  const settingsData = settingsDB.data;

  logger.info('Scheduling jobs...');
  Object.entries(schedulesData).forEach(([side, sideSchedule]) => {
    Object.entries(sideSchedule).forEach(([day, schedule]) => {
      schedulePowerOn(
        settingsData,
        side as Side,
        day as DayOfWeek,
        schedule.power,
      );
      schedulePowerOffAndSleepAnalysis(
        settingsData,
        side as Side,
        day as DayOfWeek,
        schedule.power,
      );
      scheduleTemperatures(
        settingsData,
        side as Side,
        day as DayOfWeek,
        schedule.temperatures,
      );
      scheduleElevations(
        settingsData,
        side as Side,
        day as DayOfWeek,
        schedule.elevations,
      );
      scheduleAlarm(settingsData, side as Side, day as DayOfWeek, schedule);
    });
  });
  schedulePrimingRebootAndCalibration(settingsData);

  logger.info('Done scheduling jobs!');
}

function isSystemDateValid() {
  const currentYear = new Date().getFullYear();
  return currentYear > 2010;
}

let RETRY_COUNT = 0;
let SYSTEM_DATE_SET = false;

function waitForValidDateAndSetupJobs() {
  if (isSystemDateValid()) {
    logger.info('System date is valid. Setting up jobs...');
    SYSTEM_DATE_SET = true;
    setupJobs();
  } else {
    RETRY_COUNT++;
    logger.debug(
      `System date is invalid (year 2010). Retrying in 10 seconds... (Attempt #${RETRY_COUNT}})`,
    );
    setTimeout(waitForValidDateAndSetupJobs, 10_000);
  }
}

// Monitor the JSON file and refresh jobs on change
chokidar.watch(config.lowDbFolder).on('change', () => {
  logger.info('Detected DB change, reloading...');
  if (SYSTEM_DATE_SET) {
    setupJobs();
  } else {
    waitForValidDateAndSetupJobs();
  }
});

// Initial job setup
waitForValidDateAndSetupJobs();
