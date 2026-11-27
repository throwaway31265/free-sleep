import express, { Request, Response } from 'express';
import {
  AlarmJob,
  AlarmJobSchema,
} from '../../db/schedulesSchema.js';
import logger from '../../logger.js';
import schedulesDB from '../../db/schedules.js';
import { executeAlarm } from '../../jobs/alarmScheduler.js';

const router = express.Router();

router.post('/alarm', async (req: Request, res: Response) => {
  const body = req.body;
  const validationResult = AlarmJobSchema.safeParse(body);
  if (!validationResult.success) {
    logger.error('Invalid schedules update:', validationResult.error);
    res.status(400).json({
      error: 'Invalid request data',
      details: validationResult?.error?.errors,
    });
    return;
  }
  const alarmJob: AlarmJob = validationResult.data;
  // Await so the 200 means the alarm command reached the firmware (a Stop sent after it wins).
  await executeAlarm(alarmJob);
  res.status(200).json(schedulesDB.data);
});


export default router;
