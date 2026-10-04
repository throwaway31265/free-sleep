// LowDB, stores the schedules in /persistent/free-sleep-data/lowdb/schedulesDB.json

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="7ed451b1-4dd1-5acd-8d4c-e695b94a21b2")}catch(e){}}();
import _ from 'lodash';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import config from '../config.js';
const defaultDailySchedule = {
    temperatures: {},
    power: {
        on: '21:00',
        off: '09:00',
        enabled: false,
        onTemperature: 82,
    },
    alarm: {
        time: '09:00',
        vibrationIntensity: 100,
        vibrationPattern: 'rise',
        duration: 10,
        enabled: false,
        alarmTemperature: 82,
    }
};
const defaultSideSchedule = {
    sunday: defaultDailySchedule,
    monday: defaultDailySchedule,
    tuesday: defaultDailySchedule,
    wednesday: defaultDailySchedule,
    thursday: defaultDailySchedule,
    friday: defaultDailySchedule,
    saturday: defaultDailySchedule,
};
const defaultData = {
    left: _.cloneDeep(defaultSideSchedule),
    right: _.cloneDeep(defaultSideSchedule),
};
const file = new JSONFile(`${config.lowDbFolder}schedulesDB.json`);
const schedulesDB = new Low(file, defaultData);
await schedulesDB.read();
// Allows us to add default values to the schedules if users have existing schedulesDB.json data
schedulesDB.data = _.merge({}, defaultData, schedulesDB.data);
await schedulesDB.write();
export default schedulesDB;
//# sourceMappingURL=schedules.js.map
//# debugId=7ed451b1-4dd1-5acd-8d4c-e695b94a21b2
