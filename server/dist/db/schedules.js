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
        time: "09:00",
        vibrationIntensity: 1,
        vibrationPattern: 'rise',
        duration: 1,
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
