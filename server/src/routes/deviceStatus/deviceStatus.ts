import express, { type Request, type Response } from 'express';
import type { DeepPartial } from 'ts-essentials';
import { getFranken } from '../../8sleep/frankenServer.js';
import logger from '../../logger.js';
import {
  type DeviceStatus,
  DeviceStatusUpdateSchema,
} from './deviceStatusSchema.js';
import { updateDeviceStatus } from './updateDeviceStatus.js';

const router = express.Router();

router.get('/deviceStatus', async (req: Request, res: Response) => {
  try {
    // Set a timeout for the entire operation (10 seconds)
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Device status request timed out')), 10000)
    );

    const deviceStatusPromise = (async () => {
      const franken = await getFranken();
      return await franken.getDeviceStatus();
    })();

    const resp = await Promise.race([deviceStatusPromise, timeout]);
    res.json(resp);
  } catch (error) {
    logger.error('Error getting device status:', error);
    res.status(503).json({
      error: 'Device status unavailable',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/deviceStatus', async (req: Request, res: Response) => {
  const { body } = req;
  // Validate against dedicated update schema allowing nested partials
  const validationResult = DeviceStatusUpdateSchema.safeParse(body);
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
