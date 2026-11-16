import { copyFileSync, existsSync, writeFileSync } from 'fs';
import type { DailySchedule, Schedules } from './schedulesSchema.js';
import { convertFromEvenSpreadF } from './temperatureCurve.js';

const convertDailySchedule = (dailySchedule: DailySchedule): DailySchedule => ({
  ...dailySchedule,
  temperatures: Object.fromEntries(
    Object.entries(dailySchedule.temperatures).map(([time, temperatureF]) => [time, convertFromEvenSpreadF(temperatureF)]),
  ),
  power: { ...dailySchedule.power, onTemperature: convertFromEvenSpreadF(dailySchedule.power.onTemperature) },
  alarm: { ...dailySchedule.alarm, alarmTemperature: convertFromEvenSpreadF(dailySchedule.alarm.alarmTemperature) },
});

// Rewrites every saved temperature from the old even 55-110°F spread to the measured curve, so
// each schedule keeps setting the bed to the same level as before.
export function convertScheduleTemperatures(schedules: Schedules): Schedules {
  const convertSide = (sideSchedule: Schedules['left']) => Object.fromEntries(
    Object.entries(sideSchedule).map(([day, dailySchedule]) => [day, convertDailySchedule(dailySchedule)]),
  ) as Schedules['left'];
  return { left: convertSide(schedules.left), right: convertSide(schedules.right) };
}

// Runs the conversion once per Pod. A marker file records that it has been done, and the
// schedules as they were are kept next to it in case they are wanted back.
export function migrateTemperatureScaleOnce(
  schedules: Schedules,
  { schedulesFile, dataFolder }: { schedulesFile: string; dataFolder: string },
): Schedules {
  const markerFile = `${dataFolder}temperature_scale_version.txt`;
  if (existsSync(markerFile)) return schedules;
  if (existsSync(schedulesFile)) copyFileSync(schedulesFile, `${dataFolder}schedulesDB.before-measured-temperatures.json`);
  const converted = convertScheduleTemperatures(schedules);
  writeFileSync(markerFile, 'measured-curve-1\n');
  return converted;
}
