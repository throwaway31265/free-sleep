import express, { type Request, type Response } from 'express';
import _ from 'lodash';
import logger from '../../logger.js';

const router = express.Router();

import settingsDB from '../../db/settings.js';
import { SettingsUpdateSchema } from '../../db/settingsSchema.js';
import { updateDeviceStatus } from '../deviceStatus/updateDeviceStatus.js';

router.get('/settings', async (req: Request, res: Response) => {
  await settingsDB.read();
  res.json(settingsDB.data);
});

router.post('/settings', async (req: Request, res: Response) => {
  const { body } = req;
  const validationResult = SettingsUpdateSchema.safeParse(body);
  if (!validationResult.success) {
    logger.error('Invalid settings update:', validationResult.error);
    res.status(400).json({
      error: 'Invalid request data',
      details: validationResult?.error?.message,
    });
    return;
  }
  await settingsDB.read();
  const before = _.cloneDeep(settingsDB.data);
  _.merge(settingsDB.data, body);
  // Persist the change first so a refetch returns updated values immediately
  await settingsDB.write();
  // If away mode was turned on for a side, immediately turn that side off.
  // If away mode was turned off, clear any scheduled return.
  try {
    const sides: Array<'left' | 'right'> = ['left', 'right'];
    for (const side of sides) {
      const prev = before[side];
      const next = settingsDB.data[side];
      if (prev.awayMode !== next.awayMode) {
        if (next.awayMode) {
          // Turn off this side when entering away mode
          try {
            await updateDeviceStatus({ [side]: { isOn: false } });
          } catch (err) {
            logger.warn(`Failed to power off ${side} side when enabling away mode: ${String(err)}`);
          }
        } else {
          // Clearing away: remove any awayReturn timestamp
          next.awayReturn = null;
        }
      }
    }
  } catch (e) {
    logger.warn('Error applying away-mode side-effects:', e);
  }
  res.status(200).json(settingsDB.data);
});

export default router;
