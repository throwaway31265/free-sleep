import schedule from 'node-schedule';
import { Settings } from '../db/settingsSchema.js';
import logger from '../logger.js';
import { exec } from 'child_process';


export const scheduleAnalysis = (settingsData: Settings) => {
  const { timeZone, analysisDaily } = settingsData;
  if (timeZone === null) return;
  if (!analysisDaily.enabled) return;
  const dailyRule = new schedule.RecurrenceRule();
  const { time, estimatedSleepStart, estimatedSleepEnd } = analysisDaily;
  const [onHour, onMinute] = time.split(':').map(Number);
  dailyRule.hour = onHour;
  dailyRule.minute = onMinute;
  dailyRule.tz = timeZone;

  // TODO: Implement analysis job

  logger.debug(`Scheduling daily sleep analysis job at ${analysisDaily.time}`);
  schedule.scheduleJob(`daily-analysis-${time}`, dailyRule, async () => {
    logger.info(`Executing scheduled analysis job`);

    // get current date
    const currentDate = new Date().toISOString().split('T')[0];

    // Make two date objects for sleep start and sleep end
    const sleepStart = new Date(currentDate + ' ' + analysisDaily.estimatedSleepStart);
    const sleepEnd = new Date(currentDate + ' ' + analysisDaily.estimatedSleepEnd);

    // If sleep start is after sleep end, then we need to take one day off sleep start (presuming overnight)
    if (sleepStart > sleepEnd) {
      sleepStart.setDate(sleepStart.getDate() - 1);
    }

    // Then we need to format the arguments as YYYY-MM-DD HH:MM
    const sleepStartFormatted = sleepStart.toISOString().split('T')[0] + ' ' + sleepStart.toISOString().split('T')[1].split('.')[0];
    const sleepEndFormatted = sleepEnd.toISOString().split('T')[0] + ' ' + sleepEnd.toISOString().split('T')[1].split('.')[0];

    const command = `/home/dac/free-sleep/analysis/sleep-decoder ` +
      `--start-time ${sleepStartFormatted} ` +
      `--end-time ${sleepEndFormatted}` +
      `--csv-output /home/dac/free-sleep-database/analysis/${currentDate}.csv` +
      `/persistent`;

    exec(command);
  });
};
