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
  // Note: In basic mode, unassigned schedules are intentional (inactive schedules waiting to be activated)
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
      const isBasicMode = schedulesDB.data[side].mode === 'basic';

      // Find orphaned entities
      Object.keys(schedules).forEach((scheduleId) => {
        if (!assignedIds.has(scheduleId)) {
          // In basic mode, keep unassigned schedules (they're inactive schedules)
          // Only delete orphans in day-specific mode
          if (!isBasicMode) {
            logger.info(
              `Removing orphaned schedule entity ${scheduleId} from ${side} side`,
            );
            delete schedules[scheduleId];
            needsCleanup = true;
          }
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
    const { side, days, schedule, name } = body;

    if (!side || !schedule) {
      res.status(400).json({ error: 'Missing required fields for create operation' });
      return;
    }

    const typedSide = side as Side;
    const isBasicMode = schedulesDB.data[typedSide].mode === 'basic';

    // In basic mode, days parameter is optional (always assigns to all days)
    // In day-specific mode, days parameter is required
    if (!isBasicMode && !days) {
      res.status(400).json({ error: 'days parameter required in day-specific mode' });
      return;
    }

    // Ensure V2 structure exists
    if (!schedulesDB.data[typedSide].schedules) {
      schedulesDB.data[typedSide].schedules = {};
    }
    if (!schedulesDB.data[typedSide].assignments) {
      schedulesDB.data[typedSide].assignments = {} as Record<DayOfWeek, string>;
    }

    const newEntity: ScheduleEntity = {
      id: randomUUID(),
      name: name || undefined,
      data: schedule,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Store entity
    schedulesDB.data[typedSide].schedules![newEntity.id] = newEntity;

    // Determine which days to assign
    const allDays: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    if (isBasicMode) {
      // In basic mode: Only assign to days and set as active if this is the FIRST schedule
      const scheduleCount = Object.keys(schedulesDB.data[typedSide].schedules!).length;
      const isFirstSchedule = scheduleCount === 1; // We just added one, so 1 means it's the first

      if (isFirstSchedule) {
        // First schedule: assign to all days and set as active
        allDays.forEach((day: DayOfWeek) => {
          schedulesDB.data[typedSide].assignments![day] = newEntity.id;
        });
        schedulesDB.data[typedSide].activeScheduleId = newEntity.id;
        logger.info(`First schedule in basic mode - assigned to all days and set as active`);
      } else {
        // Subsequent schedules: just store them, don't assign to days or set as active
        // User will explicitly switch to them when ready
        logger.info(`Additional schedule in basic mode - stored but not assigned (user can switch to it later)`);
      }
    } else {
      // Day-specific mode: assign to specified days
      days.forEach((day: DayOfWeek) => {
        schedulesDB.data[typedSide].assignments![day] = newEntity.id;
      });
    }

    // Sync to legacy days field
    const syncedDays = syncDaysFromEntities(
      schedulesDB.data[typedSide].schedules!,
      schedulesDB.data[typedSide].assignments!,
    );
    Object.assign(schedulesDB.data[typedSide], syncedDays);

    await schedulesDB.write();
    logger.info(`Created schedule entity ${newEntity.id}${name ? ` (${name})` : ''}`);
    res.status(200).json(schedulesDB.data);
    return;
  }

  if (operation === 'updateGroup') {
    // Update existing schedule entity and reassign days
    const { side, scheduleId, days, schedule, name } = body;

    if (!side || !scheduleId || !schedule) {
      res.status(400).json({ error: 'Missing required fields for updateGroup operation' });
      return;
    }

    const typedSide = side as Side;
    const isBasicMode = schedulesDB.data[typedSide].mode === 'basic';

    // In day-specific mode, days parameter is required
    // In basic mode, days parameter is optional (always updates all days)
    if (!isBasicMode && !days) {
      res.status(400).json({ error: 'days parameter required in day-specific mode' });
      return;
    }

    if (!schedulesDB.data[typedSide].schedules?.[scheduleId]) {
      res.status(404).json({ error: 'Schedule entity not found' });
      return;
    }

    // Update entity
    schedulesDB.data[typedSide].schedules![scheduleId].data = schedule;
    if (name !== undefined) {
      schedulesDB.data[typedSide].schedules![scheduleId].name = name || undefined;
    }
    schedulesDB.data[typedSide].schedules![scheduleId].updatedAt = Date.now();

    // Reassign days to this schedule
    const allDays: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const daysToAssign = isBasicMode ? allDays : days;
    daysToAssign.forEach((day: DayOfWeek) => {
      schedulesDB.data[typedSide].assignments![day] = scheduleId;
    });

    // Sync to legacy days field
    const syncedDays = syncDaysFromEntities(
      schedulesDB.data[typedSide].schedules!,
      schedulesDB.data[typedSide].assignments!,
    );
    Object.assign(schedulesDB.data[typedSide], syncedDays);

    await schedulesDB.write();
    logger.info(`Updated schedule entity ${scheduleId}${name ? ` (${name})` : ''} for ${daysToAssign.join(', ')}`);
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

  if (operation === 'setMode') {
    // Switch between day-specific and basic mode
    const { side, mode } = body;

    if (!side || !mode) {
      res.status(400).json({ error: 'Missing required fields for setMode operation' });
      return;
    }

    if (mode !== 'day-specific' && mode !== 'basic') {
      res.status(400).json({ error: 'Invalid mode. Must be day-specific or basic' });
      return;
    }

    const typedSide = side as Side;

    if (mode === 'basic') {
      // Switching to basic mode: pick current day's schedule as active
      const allDays: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = allDays[new Date().getDay()];
      const activeScheduleId = schedulesDB.data[typedSide].assignments?.[currentDay];

      if (activeScheduleId) {
        schedulesDB.data[typedSide].activeScheduleId = activeScheduleId;
        // Assign this schedule to all days
        allDays.forEach((day) => {
          schedulesDB.data[typedSide].assignments![day] = activeScheduleId;
        });
      }
    } else {
      // Switching to day-specific mode: clear activeScheduleId
      schedulesDB.data[typedSide].activeScheduleId = undefined;
      // Keep current assignments as-is
    }

    schedulesDB.data[typedSide].mode = mode;

    // Sync to legacy days field
    const syncedDays = syncDaysFromEntities(
      schedulesDB.data[typedSide].schedules!,
      schedulesDB.data[typedSide].assignments!,
    );
    Object.assign(schedulesDB.data[typedSide], syncedDays);

    await schedulesDB.write();
    logger.info(`Switched ${typedSide} side to ${mode} mode`);
    res.status(200).json(schedulesDB.data);
    return;
  }

  if (operation === 'switchBasicSchedule') {
    // Switch active schedule in basic mode (applies to all days)
    const { side, scheduleId } = body;

    if (!side || !scheduleId) {
      res.status(400).json({ error: 'Missing required fields for switchBasicSchedule operation' });
      return;
    }

    const typedSide = side as Side;

    if (schedulesDB.data[typedSide].mode !== 'basic') {
      res.status(400).json({ error: 'Can only switch schedules in basic mode' });
      return;
    }

    if (!schedulesDB.data[typedSide].schedules?.[scheduleId]) {
      res.status(404).json({ error: 'Schedule entity not found' });
      return;
    }

    // Set as active schedule
    schedulesDB.data[typedSide].activeScheduleId = scheduleId;

    // Assign to all days
    const allDays: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    allDays.forEach((day) => {
      schedulesDB.data[typedSide].assignments![day] = scheduleId;
    });

    // Sync to legacy days field
    const syncedDays = syncDaysFromEntities(
      schedulesDB.data[typedSide].schedules!,
      schedulesDB.data[typedSide].assignments!,
    );
    Object.assign(schedulesDB.data[typedSide], syncedDays);

    await schedulesDB.write();
    logger.info(`Switched ${typedSide} side to schedule ${scheduleId} in basic mode`);
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
