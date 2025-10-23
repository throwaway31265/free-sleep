import chokidar from 'chokidar';
import moment from 'moment-timezone';
import schedule from 'node-schedule';
import logger from '../logger.js';
import schedulesDB from '../db/schedules.js';
import settingsDB from '../db/settings.js';
import { schedulePowerOffAndSleepAnalysis, schedulePowerOn } from './powerScheduler.js';
import { scheduleTemperatures } from './temperatureScheduler.js';
import { schedulePrimingRebootAndCalibration } from './primeScheduler.js';
import config from '../config.js';
import serverStatus from '../serverStatus.js';
import { scheduleAlarm } from './alarmScheduler.js';
async function setupJobs() {
    try {
        if (serverStatus.jobs.status !== 'not_started') {
            logger.debug('Job setup already running, skipping duplicate execution.');
            return;
        }
        serverStatus.jobs.status = 'started';
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
                schedulePowerOn(settingsData, side, day, schedule.power);
                schedulePowerOffAndSleepAnalysis(settingsData, side, day, schedule.power);
                scheduleTemperatures(settingsData, side, day, schedule.temperatures);
                scheduleAlarm(settingsData, side, day, schedule);
            });
        });
        schedulePrimingRebootAndCalibration(settingsData);
        logger.info('Done scheduling jobs!');
        serverStatus.alarmSchedule.status = 'healthy';
        serverStatus.jobs.status = 'healthy';
        serverStatus.primeSchedule.status = 'healthy';
        serverStatus.powerSchedule.status = 'healthy';
        serverStatus.rebootSchedule.status = 'healthy';
        serverStatus.temperatureSchedule.status = 'healthy';
    }
    catch (error) {
        serverStatus.jobs.status = 'failed';
        const message = error instanceof Error ? error.message : String(error);
        logger.error(error);
        serverStatus.jobs.message = message;
    }
}
function isSystemDateValid() {
    const currentYear = new Date().getFullYear();
    return currentYear > 2010;
}
let RETRY_COUNT = 0;
function waitForValidDateAndSetupJobs() {
    serverStatus.systemDate.status = 'started';
    if (isSystemDateValid()) {
        serverStatus.systemDate.status = 'healthy';
        serverStatus.systemDate.message = '';
        logger.info('System date is valid. Setting up jobs...');
        void setupJobs();
    }
    else if (RETRY_COUNT < 20) {
        serverStatus.systemDate.status = 'retrying';
        const message = `System date is invalid (year 2010). Retrying in 10 seconds... (Attempt #${RETRY_COUNT}})`;
        serverStatus.systemDate.message = message;
        RETRY_COUNT++;
        logger.debug(message);
        setTimeout(waitForValidDateAndSetupJobs, 5_000);
    }
    else {
        const message = `System date is invalid! No jobs can be scheduled! ${new Date().toISOString()} `;
        serverStatus.systemDate.message = message;
        logger.warn(message);
    }
}
// Monitor the JSON file and refresh jobs on change
chokidar.watch(config.lowDbFolder).on('change', () => {
    logger.info('Detected DB change, reloading...');
    if (serverStatus.systemDate.status === 'healthy') {
        void setupJobs();
    }
    else {
        waitForValidDateAndSetupJobs();
    }
});
// Initial job setup
waitForValidDateAndSetupJobs();
