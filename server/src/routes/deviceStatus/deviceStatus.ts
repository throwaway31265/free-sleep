import express, { type Request, type Response } from 'express';
import type { DeepPartial } from 'ts-essentials';
import { z } from 'zod';
import { getFranken, isFrankReady } from '../../8sleep/frankenServer.js';
import { getFrankenMonitor } from '../../server.js';
import memoryDB from '../../db/memoryDB.js';
import logger from '../../logger.js';
import {
  type DeviceStatus,
  DeviceStatusUpdateSchema,
} from './deviceStatusSchema.js';
import { updateDeviceStatus } from './updateDeviceStatus.js';

const router = express.Router();

router.get('/deviceStatus', async (req: Request, res: Response) => {
  try {
    // Check if frank is ready first to fail fast
    if (!isFrankReady()) {
      logger.warn('Frank service is not ready yet');
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'frank.service is not connected yet. Please wait and retry.',
      });
      res.setHeader('Retry-After', '5');
      return;
    }

    const franken = await getFranken();
    const resp = await franken.getDeviceStatus();
    res.json(resp);
  } catch (error) {
    logger.error('Error getting device status:', error);
    const isTimeout = error instanceof Error && error.message.includes('Timeout');
    res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? 'Gateway Timeout' : 'Failed to get device status',
      details: error instanceof Error ? error.message : String(error),
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

const SnoozeAlarmSchema = z.object({
  side: z.enum(['left', 'right']),
}).strict();

router.post('/deviceStatus/snooze', async (req: Request, res: Response) => {
  const { body } = req;
  const validationResult = SnoozeAlarmSchema.safeParse(body);

  if (!validationResult.success) {
    logger.error('Invalid snooze alarm request:', validationResult.error);
    res.status(400).json({
      error: 'Invalid request data',
      details: validationResult?.error?.message,
    });
    return;
  }

  try {
    const frankenMonitor = getFrankenMonitor();
    if (!frankenMonitor) {
      logger.error('FrankenMonitor not initialized');
      res.status(500).json({ error: 'FrankenMonitor not initialized' });
      return;
    }

    const { side } = validationResult.data;
    const times = { [side.charAt(0)]: Math.floor(Date.now() / 1000) };

    await frankenMonitor.dismissNotification(times, true);
    res.status(204).end();
  } catch (error) {
    logger.error('Error snoozing alarm:', error);
    res.status(500).json({ error });
  }
});

router.post('/deviceStatus/dismissPrimeNotification', async (req: Request, res: Response) => {
  try {
    await memoryDB.read();
    memoryDB.data.primeCompletedNotification = undefined;
    await memoryDB.write();
    logger.info('Prime completion notification dismissed');
    res.status(204).end();
  } catch (error) {
    logger.error('Error dismissing prime notification:', error);
    res.status(500).json({ error });
  }
});

export default router;
