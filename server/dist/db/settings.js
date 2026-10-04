// LowDB, stores the schedules in /persistent/free-sleep-data/lowdb/settingsDB.json

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="3abe3420-793f-5f0f-9e3b-adec5590b8b6")}catch(e){}}();
import _ from 'lodash';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import config from '../config.js';
const defaultSideSettings = {
    name: 'Side',
    awayMode: false,
    scheduleOverrides: {
        temperatureSchedules: {
            disabled: false,
            expiresAt: ''
        },
        alarm: {
            disabled: false,
            timeOverride: '',
            expiresAt: '',
        }
    },
    taps: {
        doubleTap: {
            type: 'temperature',
            change: 'decrement',
            amount: 1,
        },
        tripleTap: {
            type: 'temperature',
            change: 'increment',
            amount: 1,
        },
        quadTap: {
            type: 'alarm',
            behavior: 'dismiss',
            snoozeDuration: 60,
            inactiveAlarmBehavior: 'power',
        },
    }
};
const defaultData = {
    id: crypto.randomUUID(),
    timeZone: 'UTC',
    temperatureFormat: 'fahrenheit',
    rebootDaily: true,
    left: {
        ..._.cloneDeep(defaultSideSettings),
        name: 'Left',
    },
    right: {
        ..._.cloneDeep(defaultSideSettings),
        name: 'Right',
    },
    primePodDaily: {
        enabled: false,
        time: '14:00',
    },
};
const file = new JSONFile(`${config.lowDbFolder}settingsDB.json`);
const settingsDB = new Low(file, defaultData);
await settingsDB.read();
// Allows us to add default values to the settings if users have existing settingsDB.json data
settingsDB.data = _.merge({}, defaultData, settingsDB.data);
await settingsDB.write();
export default settingsDB;
//# sourceMappingURL=settings.js.map
//# debugId=3abe3420-793f-5f0f-9e3b-adec5590b8b6
