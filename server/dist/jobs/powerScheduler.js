
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="6b43c70f-e2b3-5d28-8caa-657592d8aaa4")}catch(e){}}();
import schedule from 'node-schedule';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { getDayIndexForSchedule, getDayOfWeekIndex, logJob } from './utils.js';
import { executeAnalyzeSleep } from './analyzeSleep.js';
import moment from 'moment-timezone';
import serverStatus from '../serverStatus.js';
import logger from '../logger.js';
import servicesDB from '../db/services.js';
import memoryDB from '../db/memoryDB.js';
export const schedulePowerOn = (settingsData, side, day, power) => {
    if (!power.enabled)
        return;
    if (settingsData[side].awayMode)
        return;
    if (settingsData.timeZone === null)
        return;
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
        try {
            logJob('Executing power on job', side, day, dayOfWeekIndex, time);
            await updateDeviceStatus({
                [side]: {
                    isOn: true,
                    targetTemperatureF: power.onTemperature
                }
            });
            serverStatus.status.powerSchedule.status = 'healthy';
            serverStatus.status.powerSchedule.message = '';
        }
        catch (error) {
            serverStatus.status.powerSchedule.status = 'failed';
            const message = error instanceof Error ? error.message : String(error);
            serverStatus.status.powerSchedule.message = message;
            logger.error(error);
        }
    });
};
const scheduleAnalyzeSleep = (dayOfWeekIndex, offHour, offMinute, timeZone, side, day) => {
    const dailyRule = new schedule.RecurrenceRule();
    const adjustedOffMinute = offMinute;
    dailyRule.dayOfWeek = dayOfWeekIndex;
    dailyRule.hour = offHour;
    dailyRule.minute = adjustedOffMinute;
    dailyRule.tz = timeZone;
    const time = `${String(offHour).padStart(2, '0')}:${String(adjustedOffMinute).padStart(2, '0')}`;
    logJob('Scheduling daily sleep analyzer job', side, day, dayOfWeekIndex, time);
    schedule.scheduleJob(`daily-analyze-sleep-${time}-${side}`, dailyRule, async () => {
        await servicesDB.read();
        if (!servicesDB.data.biometrics.enabled) {
            logger.debug('Not executing sleep analyzer job, biometrics is disabled');
            return;
        }
        await memoryDB.read();
        const now = performance.now();
        if (memoryDB.data[side].analyzeSleep.lastRan) {
            const diffMs = now - memoryDB.data[side].analyzeSleep.lastRan;
            const tenMinutesMs = 10 * 60 * 1000;
            if (diffMs <= tenMinutesMs) {
                logJob('Duplicate job detected, exiting!', side, day, dayOfWeekIndex, time);
                return;
            }
        }
        memoryDB.data[side].analyzeSleep.lastRan = now;
        await memoryDB.write();
        logJob('Executing daily sleep analyzer job', side, day, dayOfWeekIndex, time);
        // Subtract a fixed start time
        executeAnalyzeSleep(side, moment().subtract(12, 'hours').toISOString(), moment().add(1, 'hours').toISOString());
    });
};
export const schedulePowerOffAndSleepAnalysis = (settingsData, side, day, power) => {
    if (!power.enabled)
        return;
    if (settingsData[side].awayMode)
        return;
    if (settingsData.timeZone === null)
        return;
    const offRule = new schedule.RecurrenceRule();
    const dayOfWeekIndex = getDayIndexForSchedule(day, power.off, power.on);
    offRule.dayOfWeek = dayOfWeekIndex;
    const time = power.off;
    const [offHour, offMinute] = time.split(':').map(Number);
    offRule.hour = offHour;
    offRule.minute = offMinute;
    offRule.tz = settingsData.timeZone;
    scheduleAnalyzeSleep(dayOfWeekIndex, offHour, offMinute, settingsData.timeZone, side, day);
    logJob('Scheduling power off job', side, day, dayOfWeekIndex, time);
    schedule.scheduleJob(`${side}-${day}-${time}-power-off`, offRule, async () => {
        try {
            logJob('Executing power off job', side, day, dayOfWeekIndex, time);
            await updateDeviceStatus({
                [side]: {
                    isOn: false,
                }
            });
            serverStatus.status.powerSchedule.status = 'healthy';
            serverStatus.status.powerSchedule.message = '';
        }
        catch (error) {
            serverStatus.status.powerSchedule.status = 'failed';
            const message = error instanceof Error ? error.message : String(error);
            serverStatus.status.powerSchedule.message = message;
            logger.error(error);
        }
    });
};
//# sourceMappingURL=powerScheduler.js.map
//# debugId=6b43c70f-e2b3-5d28-8caa-657592d8aaa4
