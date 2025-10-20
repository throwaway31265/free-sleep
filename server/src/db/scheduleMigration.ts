// Migration utilities for converting legacy schedule format to V2 entity model
import { randomUUID } from 'node:crypto';
import logger from '../logger.js';
import type {
  DailySchedule,
  DayOfWeek,
  ScheduleEntity,
  SideSchedule,
  SideScheduleV2,
} from './schedulesSchema.js';

// Normalize schedule for comparison (from scheduleGrouping.ts logic)
const normalizeScheduleForComparison = (schedule: DailySchedule): string => {
  const normalized = {
    power: {
      enabled: schedule.power.enabled,
      on: schedule.power.on,
      off: schedule.power.off,
      onTemperature: schedule.power.onTemperature,
    },
    alarm: {
      enabled: schedule.alarm.enabled,
      time: schedule.alarm.time,
      vibrationIntensity: schedule.alarm.vibrationIntensity,
      vibrationPattern: schedule.alarm.vibrationPattern,
      duration: schedule.alarm.duration,
      alarmTemperature: schedule.alarm.alarmTemperature,
    },
    temperatures: schedule.temperatures,
    elevations: schedule.elevations,
  };

  // Convert to JSON string for comparison with sorted keys
  const sortedJsonString = JSON.stringify(normalized, (_key, value) => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const sortedObj: any = {};
      Object.keys(value)
        .sort()
        .forEach((sortedKey) => {
          sortedObj[sortedKey] = value[sortedKey];
        });
      return sortedObj;
    }
    return value;
  });

  return sortedJsonString;
};

/**
 * Migrates legacy side schedule format to V2 entity model
 * Groups identical schedules to avoid duplication
 */
export function migrateToV2(oldSide: SideSchedule): SideScheduleV2 {
  logger.info('Migrating side schedule to V2 format...');

  const schedules: Record<string, ScheduleEntity> = {};
  const assignments: Record<DayOfWeek, string> = {} as Record<DayOfWeek, string>;
  const seenSchedules = new Map<string, string>(); // normalized -> scheduleId

  const days: (keyof SideSchedule)[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];

  days.forEach((day) => {
    const schedule = oldSide[day];
    const normalized = normalizeScheduleForComparison(schedule);

    let scheduleId = seenSchedules.get(normalized);
    if (!scheduleId) {
      // Create new schedule entity for this unique schedule
      scheduleId = randomUUID();
      schedules[scheduleId] = {
        id: scheduleId,
        data: schedule,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      seenSchedules.set(normalized, scheduleId);
      logger.debug(`Created schedule entity ${scheduleId} for ${day}`);
    } else {
      logger.debug(`Reusing schedule entity ${scheduleId} for ${day}`);
    }

    assignments[day] = scheduleId;
  });

  logger.info(
    `Migration complete: ${Object.keys(schedules).length} unique schedules found`,
  );

  return {
    ...oldSide, // Keep legacy day-based format
    schedules,
    assignments,
    mode: 'day-specific', // Default to day-specific mode for migrated schedules
  };
}

/**
 * Syncs the legacy 'days' field from entity storage
 * This ensures backward compatibility with job scheduler
 */
export function syncDaysFromEntities(
  schedules: Record<string, ScheduleEntity>,
  assignments: Record<DayOfWeek, string>,
): SideSchedule {
  const days: Partial<SideSchedule> = {};

  const dayNames: DayOfWeek[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];

  dayNames.forEach((day) => {
    const scheduleId = assignments[day];
    if (scheduleId && schedules[scheduleId]) {
      days[day] = schedules[scheduleId].data;
    }
  });

  return days as SideSchedule;
}

/**
 * Checks if a side schedule is already in V2 format
 */
export function isV2Format(side: any): side is SideScheduleV2 {
  return side.schedules !== undefined && side.assignments !== undefined;
}
