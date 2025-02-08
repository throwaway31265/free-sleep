import _ from 'lodash';
import express, { Request, Response } from 'express';
// @ts-ignore
import { partialUtil } from 'zod/lib/helpers/partialUtil';
import DeepPartial = partialUtil.DeepPartial;
import { Schedules } from '../../db/schedulesSchema.js';
import logger from '../../logger.js';
import schedulesDB from '../../db/schedules.js';


import {
  DailySchedule,
  DayOfWeek,
  SchedulesSchema,
  Side,
  SideSchedule,
} from '../../db/schedulesSchema.js';

const router = express.Router();


router.get('/schedules', async (req: Request, res: Response) => {
  await schedulesDB.read();
  res.json(schedulesDB.data);
});

router.post('/schedules', async (req: Request, res: Response) => {
  const body = req.body;
  const validationResult = SchedulesSchema.deepPartial().safeParse(body);
  if (!validationResult.success) {
    logger.error('Invalid schedules update:', validationResult.error);
    res.status(400).json({
      error: 'Invalid request data',
      details: validationResult?.error?.errors,
    });
    return;
  }
  // @ts-ignore
  const schedules: DeepPartial<Schedules> = validationResult.data;
  await schedulesDB.read();

  (
    Object.entries(schedules) as [Side, Partial<SideSchedule>][]).forEach(([side, sideSchedule]) => {
    (Object.entries(sideSchedule) as [DayOfWeek, Partial<DailySchedule>][]).forEach(([day, schedule]) => {
      if (schedule.power) {
        _.merge(schedulesDB.data[side][day].power, schedule.power);
      }
      if (schedule.temperatures) schedulesDB.data[side][day].temperatures = schedule.temperatures;
      if (schedule.alarm) schedulesDB.data[side][day].alarm = schedule.alarm;
    });
  });
  await schedulesDB.write();
  res.status(200).json(schedulesDB.data);
});


export default router;
