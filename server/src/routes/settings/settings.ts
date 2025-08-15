import express, { type Request, type Response } from 'express';
import _ from 'lodash';
import logger from '../../logger.js';

const router = express.Router();

import settingsDB from '../../db/settings.js';
import { SettingsUpdateSchema } from '../../db/settingsSchema.js';

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
  _.merge(settingsDB.data, body);
  await settingsDB.write();
  res.status(200).json(settingsDB.data);
});

export default router;
