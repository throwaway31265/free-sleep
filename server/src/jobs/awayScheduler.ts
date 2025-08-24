import schedule from 'node-schedule';
import moment from 'moment-timezone';
import type { Settings } from '../db/settingsSchema.js';
import settingsDB from '../db/settings.js';
import logger from '../logger.js';

function scheduleResume(side: 'left' | 'right', whenIso: string) {
  const when = moment(whenIso);
  if (!when.isValid()) {
    logger.warn(`[awayScheduler] Invalid awayReturn for ${side}: ${whenIso}`);
    return;
  }
  const jobName = `away-resume-${side}`;
  // Cancel any existing job for this side
  const existing = schedule.scheduledJobs[jobName];
  if (existing) existing.cancel();

  logger.info(`[awayScheduler] Scheduling away resume for ${side} at ${when.toISOString()}`);
  schedule.scheduleJob(jobName, when.toDate(), async () => {
    try {
      await settingsDB.read();
      settingsDB.data[side].awayMode = false;
      settingsDB.data[side].awayReturn = null;
      await settingsDB.write();
      logger.info(`[awayScheduler] ${side} side resumed from away mode`);
    } catch (error) {
      logger.error(`[awayScheduler] Failed to resume ${side}: ${String(error)}`);
    }
  });
}

export function scheduleAwayResumes(settings: Settings) {
  (['left', 'right'] as const).forEach((side) => {
    const sideSettings = settings[side];
    // Only schedule if currently away AND a future return time exists
    const whenIso = sideSettings.awayReturn ?? null;
    if (!sideSettings.awayMode || !whenIso) return;

    const now = moment();
    const when = moment(whenIso);

    if (!when.isValid()) {
      logger.warn(`[awayScheduler] Invalid awayReturn value for ${side}: ${whenIso}`);
      return;
    }

    if (when.isBefore(now)) {
      // If the time has passed, immediately clear away
      logger.info(`[awayScheduler] awayReturn in past for ${side}; resuming now`);
      settingsDB.data[side].awayMode = false;
      settingsDB.data[side].awayReturn = null;
      settingsDB.write();
      return;
    }

    scheduleResume(side, whenIso);
  });
}

