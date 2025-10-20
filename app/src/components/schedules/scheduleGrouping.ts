import type {
  DailySchedule,
  DayOfWeek,
  ScheduleEntity,
  SideScheduleV2,
} from '@api/schedulesSchema';
import _ from 'lodash';

export interface ScheduleGroup {
  id: string;
  scheduleId: string; // NEW: Reference to schedule entity
  schedule: DailySchedule;
  days: DayOfWeek[];
  dayIndices: number[];
}

export const DAY_ABBREVIATIONS: Record<DayOfWeek, string> = {
  sunday: 'Sun',
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
};

export const DAYS_ORDER: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

// Create a normalized version of a schedule for comparison
// This focuses on core schedule settings and includes elevation presets
const normalizeScheduleForComparison = (schedule: DailySchedule): string => {
  // Create a simplified object focusing on the most important settings
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
    // Include full elevation details including presets to ensure proper grouping
    elevations: schedule.elevations,
  };

  // Convert to JSON string for comparison with sorted keys at all levels
  const sortedJsonString = JSON.stringify(normalized, (__key, value) => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Sort object keys for consistent comparison
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
 * V2: Groups schedules by entity assignments
 * This is the new preferred method that uses the entity model
 */
export const groupSchedulesByAssignments = (
  schedules: Record<string, ScheduleEntity>,
  assignments: Record<DayOfWeek, string>,
): ScheduleGroup[] => {
  const groups: Record<string, ScheduleGroup> = {};

  Object.entries(assignments).forEach(([day, scheduleId]) => {
    const dayOfWeek = day as DayOfWeek;
    const dayIndex = DAYS_ORDER.indexOf(dayOfWeek);

    if (groups[scheduleId]) {
      // Add to existing group
      groups[scheduleId].days.push(dayOfWeek);
      groups[scheduleId].dayIndices.push(dayIndex);
    } else {
      // Create new group
      const entity = schedules[scheduleId];
      if (entity) {
        groups[scheduleId] = {
          id: scheduleId,
          scheduleId,
          schedule: entity.data,
          days: [dayOfWeek],
          dayIndices: [dayIndex],
        };
      }
    }
  });

  // Sort groups by the first day that appears in each group
  return Object.values(groups).sort((a, b) => {
    const aFirstDayIndex = Math.min(...a.dayIndices);
    const bFirstDayIndex = Math.min(...b.dayIndices);
    return aFirstDayIndex - bFirstDayIndex;
  });
};

/**
 * Groups side schedule by assignments if V2, falls back to legacy comparison
 */
export const groupSideSchedule = (
  sideSchedule: SideScheduleV2,
): ScheduleGroup[] => {
  // Use V2 grouping if available
  if (sideSchedule.schedules && sideSchedule.assignments) {
    return groupSchedulesByAssignments(
      sideSchedule.schedules,
      sideSchedule.assignments,
    );
  }

  // Fallback to legacy grouping
  return groupSchedulesBySettings(sideSchedule);
};

/**
 * Legacy: Groups schedules by comparing settings
 * @deprecated Use groupSchedulesByAssignments for V2 schedules
 */
export const groupSchedulesBySettings = (
  schedules: Record<DayOfWeek, DailySchedule>,
): ScheduleGroup[] => {
  const groups: Record<string, ScheduleGroup> = {};

  // Group schedules by their full normalized comparison including elevation presets
  Object.entries(schedules).forEach(([day, schedule]) => {
    const dayOfWeek = day as DayOfWeek;
    const dayIndex = DAYS_ORDER.indexOf(dayOfWeek);
    const normalizedKey = normalizeScheduleForComparison(schedule);

    if (groups[normalizedKey]) {
      // Add to existing group
      groups[normalizedKey].days.push(dayOfWeek);
      groups[normalizedKey].dayIndices.push(dayIndex);
    } else {
      // Create new group
      groups[normalizedKey] = {
        id: normalizedKey,
        scheduleId: normalizedKey, // Use normalized key as fake scheduleId
        schedule,
        days: [dayOfWeek],
        dayIndices: [dayIndex],
      };
    }
  });

  // Sort groups by the first day that appears in each group
  return Object.values(groups).sort((a, b) => {
    const aFirstDayIndex = Math.min(...a.dayIndices);
    const bFirstDayIndex = Math.min(...b.dayIndices);
    return aFirstDayIndex - bFirstDayIndex;
  });
};

export const formatGroupedDays = (days: DayOfWeek[]): string => {
  // Sort days by their order in the week
  const sortedDays = days.sort(
    (a, b) => DAYS_ORDER.indexOf(a) - DAYS_ORDER.indexOf(b),
  );

  // Check for common patterns
  const dayIndices = sortedDays.map((day) => DAYS_ORDER.indexOf(day));

  // Check if it's all 7 days
  if (sortedDays.length === 7) {
    return 'Every Day';
  }

  // Check if it's weekdays (Mon-Fri)
  const weekdayIndices = [1, 2, 3, 4, 5]; // Mon-Fri
  if (dayIndices.length === 5 && _.isEqual(dayIndices.sort(), weekdayIndices)) {
    return 'Weekdays';
  }

  // Check if it's weekends (Sat-Sun)
  const weekendIndices = [0, 6]; // Sun, Sat
  if (dayIndices.length === 2 && _.isEqual(dayIndices.sort(), weekendIndices)) {
    return 'Weekends';
  }

  // Check for consecutive days
  if (dayIndices.length > 2) {
    const isConsecutive = dayIndices.every(
      (day, index) => index === 0 || day === dayIndices[index - 1] + 1,
    );

    if (isConsecutive) {
      return `${DAY_ABBREVIATIONS[sortedDays[0]]}-${DAY_ABBREVIATIONS[sortedDays[sortedDays.length - 1]]}`;
    }
  }

  // Default: show abbreviated day names
  return sortedDays.map((day) => DAY_ABBREVIATIONS[day]).join(', ');
};
