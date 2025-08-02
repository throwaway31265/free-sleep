import { type DailySchedule, type DayOfWeek } from '@api/schedulesSchema';
import _ from 'lodash';

export interface ScheduleGroup {
  id: string;
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
const normalizeScheduleForComparison = (schedule: DailySchedule): string => {
  // Create a simplified object with only the key properties we want to compare
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

export const groupSchedulesBySettings = (
  schedules: Record<DayOfWeek, DailySchedule>,
): ScheduleGroup[] => {
  const groups: Record<string, ScheduleGroup> = {};

  Object.entries(schedules).forEach(([day, schedule]) => {
    const dayOfWeek = day as DayOfWeek;
    const dayIndex = DAYS_ORDER.indexOf(dayOfWeek); // Get the correct day index
    const normalizedKey = normalizeScheduleForComparison(schedule);

    if (groups[normalizedKey]) {
      // Add to existing group
      groups[normalizedKey].days.push(dayOfWeek);
      groups[normalizedKey].dayIndices.push(dayIndex);
    } else {
      // Create new group
      groups[normalizedKey] = {
        id: normalizedKey,
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
