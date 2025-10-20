import moment from 'moment-timezone';
import schedule from 'node-schedule';
import { updateDeviceStatus } from 'src/routes/deviceStatus/updateDeviceStatus.js';
import type { Settings } from '../db/settingsSchema.js';
import logger from '../logger.js';

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function isNightTime(
  nightStartTime: string,
  nightEndTime: string,
  currentMinutes: number,
): boolean {
  const startMinutes = parseTimeToMinutes(nightStartTime);
  const endMinutes = parseTimeToMinutes(nightEndTime);

  if (startMinutes < endMinutes) {
    // Same day period (e.g., 08:00 to 18:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight period (e.g., 22:00 to 07:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

export const scheduleLedNightMode = (settingsData: Settings) => {
  const { timeZone, ledNightMode } = settingsData;

  if (timeZone === null || !ledNightMode) {
    logger.debug('LED night mode: timezone not set or ledNightMode not configured');
    return;
  }

  if (!ledNightMode.enabled) {
    logger.debug('LED night mode is disabled');
    return;
  }

  // Check and update brightness every minute
  logger.debug('Scheduling LED night mode job (checks every minute)');
  schedule.scheduleJob('led-night-mode', '* * * * *', async () => {
    try {
      const now = moment.tz(timeZone);
      const currentMinutes = now.hours() * 60 + now.minutes();

      const isNight = isNightTime(
        ledNightMode.nightStartTime,
        ledNightMode.nightEndTime,
        currentMinutes,
      );

      const targetBrightness = isNight
        ? ledNightMode.nightBrightness
        : ledNightMode.dayBrightness;

      logger.debug(
        `LED night mode check: current=${now.format('HH:mm')}, ` +
          `isNight=${isNight}, targetBrightness=${targetBrightness}`,
      );

      // Update device status with the target brightness
      await updateDeviceStatus({
        settings: {
          ledBrightness: targetBrightness,
        },
      });
    } catch (error) {
      logger.error(`Error in LED night mode job: ${error}`);
    }
  });
};
