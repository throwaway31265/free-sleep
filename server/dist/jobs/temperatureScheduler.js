import schedule from 'node-schedule';
import { getDayIndexForSchedule, logJob } from './utils.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import serverStatus from '../serverStatus.js';
import logger from '../logger.js';
import { scheduledTarget } from '../autopilot/state.js';
const scheduleAdjustment = (timeZone, side, day, time, temperature, powerOnTime) => {
    const onRule = new schedule.RecurrenceRule();
    const dayOfWeekIndex = getDayIndexForSchedule(day, time, powerOnTime);
    const [onHour, onMinute] = time.split(':').map(Number);
    logJob('Scheduling temperature adjustment job', side, day, dayOfWeekIndex, time);
    onRule.dayOfWeek = dayOfWeekIndex;
    onRule.hour = onHour;
    onRule.minute = onMinute;
    onRule.tz = timeZone;
    schedule.scheduleJob(`${side}-${day}-${time}-${temperature}-temperature-adjustment`, onRule, async () => {
        try {
            logJob('Executing temperature adjustment job', side, day, dayOfWeekIndex, time);
            await updateDeviceStatus({
                [side]: {
                    targetTemperatureF: scheduledTarget(side, temperature),
                }
            });
            serverStatus.status.temperatureSchedule.status = 'healthy';
            serverStatus.status.temperatureSchedule.message = '';
        }
        catch (error) {
            serverStatus.status.temperatureSchedule.status = 'failed';
            const message = error instanceof Error ? error.message : String(error);
            serverStatus.status.temperatureSchedule.message = message;
            logger.error(error);
        }
    });
};
export const scheduleTemperatures = (settingsData, side, day, dailySchedule) => {
    if (settingsData[side].awayMode)
        return;
    const { timeZone } = settingsData;
    if (timeZone === null)
        return;
    Object.entries(dailySchedule.temperatures).forEach(([time, temperature]) => {
        scheduleAdjustment(timeZone, side, day, time, temperature, dailySchedule.power.on);
    });
};
//# sourceMappingURL=temperatureScheduler.js.map