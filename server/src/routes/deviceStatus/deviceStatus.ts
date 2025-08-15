import express, { type Request, type Response } from 'express';
import type { DeepPartial } from 'ts-essentials';
import { getFranken } from '../../8sleep/frankenServer.js';
import logger from '../../logger.js';
import { type DeviceStatus, DeviceStatusSchema } from './deviceStatusSchema.js';
import { updateDeviceStatus } from './updateDeviceStatus.js';

const router = express.Router();

router.get('/deviceStatus', async (req: Request, res: Response) => {
  const franken = await getFranken();
  const resp = await franken.getDeviceStatus();
  res.json(resp);
});

router.post('/deviceStatus', async (req: Request, res: Response) => {
  const { body } = req;
  const validationResult = DeviceStatusSchema.partial().safeParse(body);
  if (!validationResult.success) {
    logger.error('Invalid device status update:', validationResult.error);
    res.status(400).json({
      error: 'Invalid request data',
      details: validationResult?.error?.message,
    });
    return;
  }

  try {
    await updateDeviceStatus(body as DeepPartial<DeviceStatus>);
    res.status(204).end();
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error });
  }
});

export default router;
