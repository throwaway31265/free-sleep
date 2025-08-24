import schedule from 'node-schedule';
import moment from 'moment-timezone';
import type { Settings } from '../db/settingsSchema.js';
import settingsDB from '../db/settings.js';
import logger from '../logger.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';

function cancelJob(name: string) {
  const existing = schedule.scheduledJobs[name];
  if (existing) existing.cancel();
}

function scheduleResume(side: 'left' | 'right', whenIso: string) {
  const when = moment(whenIso);
  if (!when.isValid()) {
    logger.warn(`[awayScheduler] Invalid awayReturn for ${side}: ${whenIso}`);
    return;
  }
  const jobName = `away-resume-${side}`;
  cancelJob(jobName);

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

function scheduleStart(side: 'left' | 'right', whenIso: string) {
  const when = moment(whenIso);
  if (!when.isValid()) {
    logger.warn(`[awayScheduler] Invalid awayStart for ${side}: ${whenIso}`);
    return;
  }
  const jobName = `away-start-${side}`;
  cancelJob(jobName);

  logger.info(`[awayScheduler] Scheduling away start for ${side} at ${when.toISOString()}`);
  schedule.scheduleJob(jobName, when.toDate(), async () => {
    try {
      await settingsDB.read();
      settingsDB.data[side].awayMode = true;
      settingsDB.data[side].awayStart = null;
      await settingsDB.write();
      // Ensure side is powered off when away starts
      await updateDeviceStatus({ [side]: { isOn: false } });
      logger.info(`[awayScheduler] ${side} side entered away mode`);
    } catch (error) {
      logger.error(`[awayScheduler] Failed to start away for ${side}: ${String(error)}`);
    }
  });
}

export function scheduleAway(settings: Settings) {
  (['left', 'right'] as const).forEach((side) => {
    const sideSettings = settings[side];

    // Start scheduling
    const startIso = sideSettings.awayStart ?? null;
    if (startIso) {
      const now = moment();
      const start = moment(startIso);
      if (start.isValid()) {
        if (start.isBefore(now)) {
          // If past and not already away, enable immediately
          if (!sideSettings.awayMode) {
            logger.info(`[awayScheduler] awayStart in past for ${side}; enabling away now`);
            settingsDB.data[side].awayMode = true;
            settingsDB.data[side].awayStart = null;
            settingsDB.write();
            updateDeviceStatus({ [side]: { isOn: false } }).catch((e) =>
              logger.warn(`[awayScheduler] Failed to power off ${side} on immediate start: ${String(e)}`),
            );
          }
        } else if (!sideSettings.awayMode) {
          scheduleStart(side, startIso);
        }
      } else {
        logger.warn(`[awayScheduler] Invalid awayStart value for ${side}: ${startIso}`);
      }
    } else {
      // No start provided: if awayMode is true, that means start immediately by user action
      // nothing to schedule here.
    }

    // Return scheduling
    const returnIso = sideSettings.awayReturn ?? null;
    if (returnIso) {
      const now = moment();
      const ret = moment(returnIso);
      if (ret.isValid()) {
        if (ret.isBefore(now)) {
          // In past: clear immediately if currently away
          if (sideSettings.awayMode) {
            logger.info(`[awayScheduler] awayReturn in past for ${side}; resuming now`);
            settingsDB.data[side].awayMode = false;
            settingsDB.data[side].awayReturn = null;
            settingsDB.write();
          }
        } else if (sideSettings.awayMode) {
          scheduleResume(side, returnIso);
        }
      } else {
        logger.warn(`[awayScheduler] Invalid awayReturn value for ${side}: ${returnIso}`);
      }
    }
  });
}
