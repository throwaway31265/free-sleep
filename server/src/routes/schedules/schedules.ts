import express, { type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import _ from 'lodash';
import type { DeepPartial } from 'ts-essentials';
import schedulesDB from '../../db/schedules.js';
import { syncDaysFromEntities } from '../../db/scheduleMigration.js';
import {
  type DailySchedule,
  type DayOfWeek,
  type Schedules,
  type ScheduleEntity,
  SchedulesUpdateSchema,
  type Side,
  type SideSchedule,
} from '../../db/schedulesSchema.js';
import logger from '../../logger.js';

const router = express.Router();

router.get('/schedules', async (req: Request, res: Response) => {
  await schedulesDB.read();

  // Clean up orphaned schedule entities (entities not assigned to any day)
  let needsCleanup = false;
  ['left', 'right'].forEach((sideKey) => {
    const side = sideKey as Side;
    if (
      schedulesDB.data[side].schedules &&
      schedulesDB.data[side].assignments
    ) {
      const assignments = schedulesDB.data[side].assignments!;
      const schedules = schedulesDB.data[side].schedules!;
      const assignedIds = new Set(Object.values(assignments));

      // Find orphaned entities
      Object.keys(schedules).forEach((scheduleId) => {
        if (!assignedIds.has(scheduleId)) {
          logger.info(
            `Removing orphaned schedule entity ${scheduleId} from ${side} side`,
          );
          delete schedules[scheduleId];
          needsCleanup = true;
        }
      });
    }
  });

  if (needsCleanup) {
    await schedulesDB.write();
    logger.info('Cleaned up orphaned schedule entities');
  }

  res.json(schedulesDB.data);
});

router.post('/schedules', async (req: Request, res: Response) => {
  const body = req.body;
  const { operation } = body;

  await schedulesDB.read();

  // V2 Entity-based operations
  if (operation === 'create') {
    // Create new schedule entity and assign to days
    const { side, days, schedule } = body;

    if (!side || !days || !schedule) {
      res.status(400).json({ error: 'Missing required fields for create operation' });
      return;
    }

    const typedSide = side as Side;

    // Ensure V2 structure exists
    if (!schedulesDB.data[typedSide].schedules) {
      schedulesDB.data[typedSide].schedules = {};
    }
    if (!schedulesDB.data[typedSide].assignments) {
      schedulesDB.data[typedSide].assignments = {} as Record<DayOfWeek, string>;
    }

    const newEntity: ScheduleEntity = {
      id: randomUUID(),
      data: schedule,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Store entity
    schedulesDB.data[typedSide].schedules![newEntity.id] = newEntity;

    // Assign to days
    days.forEach((day: DayOfWeek) => {
      schedulesDB.data[typedSide].assignments![day] = newEntity.id;
    });

    // Sync to legacy days field
    const syncedDays = syncDaysFromEntities(
      schedulesDB.data[typedSide].schedules!,
      schedulesDB.data[typedSide].assignments!,
    );
    Object.assign(schedulesDB.data[typedSide], syncedDays);

    await schedulesDB.write();
    logger.info(`Created schedule entity ${newEntity.id} for ${days.join(', ')}`);
    res.status(200).json(schedulesDB.data);
    return;
  }

  if (operation === 'updateGroup') {
    // Update existing schedule entity
    const { side, scheduleId, schedule } = body;

    if (!side || !scheduleId || !schedule) {
      res.status(400).json({ error: 'Missing required fields for updateGroup operation' });
      return;
    }

    const typedSide = side as Side;

    if (!schedulesDB.data[typedSide].schedules?.[scheduleId]) {
      res.status(404).json({ error: 'Schedule entity not found' });
      return;
    }

    // Update entity
    schedulesDB.data[typedSide].schedules![scheduleId].data = schedule;
    schedulesDB.data[typedSide].schedules![scheduleId].updatedAt = Date.now();

    // Sync to legacy days field
    const syncedDays = syncDaysFromEntities(
      schedulesDB.data[typedSide].schedules!,
      schedulesDB.data[typedSide].assignments!,
    );
    Object.assign(schedulesDB.data[typedSide], syncedDays);

    await schedulesDB.write();
    logger.info(`Updated schedule entity ${scheduleId}`);
    res.status(200).json(schedulesDB.data);
    return;
  }

  if (operation === 'ungroupDay') {
    // Clone schedule for single day
    const { side, day, scheduleId } = body;

    if (!side || !day || !scheduleId) {
      res.status(400).json({ error: 'Missing required fields for ungroupDay operation' });
      return;
    }

    const typedSide = side as Side;
    const typedDay = day as DayOfWeek;

    if (!schedulesDB.data[typedSide].schedules?.[scheduleId]) {
      res.status(404).json({ error: 'Schedule entity not found' });
      return;
    }

    // Clone entity
    const clonedEntity: ScheduleEntity = {
      id: randomUUID(),
      data: _.cloneDeep(schedulesDB.data[typedSide].schedules![scheduleId].data),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    schedulesDB.data[typedSide].schedules![clonedEntity.id] = clonedEntity;
    schedulesDB.data[typedSide].assignments![typedDay] = clonedEntity.id;

    // Sync to legacy days field
    const syncedDays = syncDaysFromEntities(
      schedulesDB.data[typedSide].schedules!,
      schedulesDB.data[typedSide].assignments!,
    );
    Object.assign(schedulesDB.data[typedSide], syncedDays);

    await schedulesDB.write();
    logger.info(`Ungrouped day ${typedDay} with new schedule entity ${clonedEntity.id}`);
    res.status(200).json(schedulesDB.data);
    return;
  }

  // Legacy operation - validate and merge updates into days
  const validationResult = SchedulesUpdateSchema.safeParse(body);
  if (!validationResult.success) {
    logger.error('Invalid schedules update:', validationResult.error);
    res.status(400).json({
      error: 'Invalid request data',
      details: validationResult?.error?.message,
    });
    return;
  }
  const schedules = validationResult.data as DeepPartial<Schedules>;

  (Object.entries(schedules) as [Side, Partial<SideSchedule>][]).forEach(
    ([side, sideSchedule]) => {
      (
        Object.entries(sideSchedule) as [DayOfWeek, Partial<DailySchedule>][]
      ).forEach(([day, schedule]) => {
        if (schedule.power) {
          _.merge(schedulesDB.data[side][day].power, schedule.power);
        }
        if (schedule.temperatures)
          schedulesDB.data[side][day].temperatures = schedule.temperatures;
        if (schedule.alarm) schedulesDB.data[side][day].alarm = schedule.alarm;
        if (schedule.elevations)
          schedulesDB.data[side][day].elevations = schedule.elevations;
      });
    },
  );
  await schedulesDB.write();
  res.status(200).json(schedulesDB.data);
});

router.delete(
  '/schedules/:side/:scheduleId',
  async (req: Request, res: Response) => {
    const { side, scheduleId } = req.params;
    const typedSide = side as Side;

    await schedulesDB.read();

    // Validate side and schedule existence
    if (!schedulesDB.data[typedSide]) {
      res.status(400).json({ error: 'Invalid side parameter' });
      return;
    }

    if (
      !schedulesDB.data[typedSide].schedules ||
      !schedulesDB.data[typedSide].schedules![scheduleId]
    ) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    // Find days assigned to this schedule
    const assignments = schedulesDB.data[typedSide].assignments!;
    const affectedDays: DayOfWeek[] = (
      Object.entries(assignments) as [DayOfWeek, string][]
    )
      .filter(([_, id]) => id === scheduleId)
      .map(([day]) => day);

    logger.info(
      `Deleting schedule ${scheduleId} from ${typedSide} side (affects ${affectedDays.length} days: ${affectedDays.join(', ')})`,
    );

    // Create disabled default schedule for affected days
    const defaultSchedule: DailySchedule = {
      temperatures: {},
      power: {
        on: '21:00',
        off: '09:00',
        enabled: false,
        onTemperature: 82,
      },
      alarm: {
        time: '09:00',
        vibrationIntensity: 1,
        vibrationPattern: 'rise',
        duration: 1,
        enabled: false,
        alarmTemperature: 82,
      },
      elevations: {},
    };

    // Remove the schedule entity
    delete schedulesDB.data[typedSide].schedules![scheduleId];

    // Create new individual entities for each affected day
    // This gives users flexibility to configure each day differently later
    affectedDays.forEach((day) => {
      const newId = randomUUID();
      schedulesDB.data[typedSide].schedules![newId] = {
        id: newId,
        data: _.cloneDeep(defaultSchedule),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      schedulesDB.data[typedSide].assignments![day] = newId;
    });

    // Sync to legacy days field
    const syncedDays = syncDaysFromEntities(
      schedulesDB.data[typedSide].schedules!,
      schedulesDB.data[typedSide].assignments!,
    );
    Object.assign(schedulesDB.data[typedSide], syncedDays);

    await schedulesDB.write();
    logger.info(
      `Successfully deleted schedule ${scheduleId}, created ${affectedDays.length} new default schedules`,
    );
    res.status(200).json(schedulesDB.data);
  },
);

export default router;
