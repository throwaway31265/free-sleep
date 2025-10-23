import schedule from 'node-schedule';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { getDayIndexForSchedule, getDayOfWeekIndex, logJob } from './utils.js';
import { executeAnalyzeSleep } from './analyzeSleep.js';
import moment from 'moment-timezone';
import serverStatus from '../serverStatus.js';
import logger from '../logger.js';
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
            serverStatus.powerSchedule.status = 'healthy';
            serverStatus.powerSchedule.message = '';
        }
        catch (error) {
            serverStatus.powerSchedule.status = 'failed';
            const message = error instanceof Error ? error.message : String(error);
            serverStatus.powerSchedule.message = message;
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
        logJob('Executing daily sleep analyzer job', side, day, dayOfWeekIndex, time);
        // Subtract a fixed start time
        executeAnalyzeSleep(side, moment().subtract(12, 'hours').toISOString(), moment().add(3, 'hours').toISOString());
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
    const dayOfWeekIndex = getDayIndexForSchedule(day, power.off);
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
            serverStatus.powerSchedule.status = 'healthy';
            serverStatus.powerSchedule.message = '';
        }
        catch (error) {
            serverStatus.powerSchedule.status = 'failed';
            const message = error instanceof Error ? error.message : String(error);
            serverStatus.powerSchedule.message = message;
            logger.error(error);
        }
    });
};
