import _ from 'lodash';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { DailySchedule, Schedules, SideSchedule } from './schedulesSchema.js';
import config from '../config.js';


const defaultDailySchedule: DailySchedule = {
  temperatures: {},
  power: {
    on: '21:00',
    off: '09:00',
    enabled: false,
    onTemperature: 82,
  },
  alarm: {
    time: "09:00",
    vibrationIntensity: 1,
    vibrationPattern: 'rise',
    duration: 1,
    enabled: false,
    alarmTemperature: 82,
  }
}

const defaultSideSchedule: SideSchedule = {
  sunday: defaultDailySchedule,
  monday: defaultDailySchedule,
  tuesday: defaultDailySchedule,
  wednesday: defaultDailySchedule,
  thursday: defaultDailySchedule,
  friday: defaultDailySchedule,
  saturday: defaultDailySchedule,
}

const defaultData: Schedules = {
  left: _.cloneDeep(defaultSideSchedule),
  right: _.cloneDeep(defaultSideSchedule),
};

const file = new JSONFile<Schedules>(`${config.lowDbFolder}schedulesDB.json`);
const schedulesDB = new Low<Schedules>(file, defaultData);
await schedulesDB.read();
// Allows us to add default values to the schedules if users have existing schedulesDB.json data
schedulesDB.data = _.merge({}, defaultData, schedulesDB.data);
await schedulesDB.write();

export default schedulesDB;
