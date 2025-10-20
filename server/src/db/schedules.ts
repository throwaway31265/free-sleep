// LowDB, stores the schedules in /persistent/free-sleep-data/lowdb/schedulesDB.json
import _ from 'lodash';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import config from '../config.js';
import logger from '../logger.js';
import { isV2Format, migrateToV2 } from './scheduleMigration.js';
import type {
  DailySchedule,
  DayOfWeek,
  Schedules,
  SchedulesV2,
  Side,
  SideSchedule,
} from './schedulesSchema.js';

const defaultDailySchedule: DailySchedule = {
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

const defaultSideSchedule: SideSchedule = {
  sunday: defaultDailySchedule,
  monday: defaultDailySchedule,
  tuesday: defaultDailySchedule,
  wednesday: defaultDailySchedule,
  thursday: defaultDailySchedule,
  friday: defaultDailySchedule,
  saturday: defaultDailySchedule,
};

const defaultData: Schedules = {
  left: _.cloneDeep(defaultSideSchedule),
  right: _.cloneDeep(defaultSideSchedule),
};

const file = new JSONFile<SchedulesV2>(
  `${config.lowDbFolder}schedulesDB.json`,
);
const schedulesDB = new Low<SchedulesV2>(file, defaultData as SchedulesV2);
await schedulesDB.read();

// Allows us to add default values to the schedules if users have existing schedulesDB.json data
schedulesDB.data = _.merge({}, defaultData, schedulesDB.data);

// Auto-migrate to V2 format if needed
let needsWrite = false;
if (!isV2Format(schedulesDB.data.left)) {
  logger.info('Migrating left side schedule to V2 format...');
  schedulesDB.data.left = migrateToV2(
    schedulesDB.data.left as unknown as SideSchedule,
  );
  needsWrite = true;
}
if (!isV2Format(schedulesDB.data.right)) {
  logger.info('Migrating right side schedule to V2 format...');
  schedulesDB.data.right = migrateToV2(
    schedulesDB.data.right as unknown as SideSchedule,
  );
  needsWrite = true;
}

if (needsWrite) {
  logger.info('Saving migrated schedules...');
  await schedulesDB.write();
  logger.info('Migration complete!');
}

/**
 * Helper to get schedule for a specific day (for job scheduler compatibility)
 */
export function getScheduleForDay(side: Side, day: DayOfWeek): DailySchedule {
  return schedulesDB.data[side][day];
}

export default schedulesDB;
