
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="f98a05b1-173e-5eba-9940-954630df819a")}catch(e){}}();
import settingsDB from './settings.js';
import moment from 'moment-timezone';
export const loadVitals = async (vitalRecords) => {
    await settingsDB.read();
    const userTimeZone = settingsDB.data.timeZone || 'UTC';
    return vitalRecords.map((vital) => ({
        ...vital,
        timestamp: moment.tz(vital.timestamp * 1000, userTimeZone).format(),
    }));
};
//# sourceMappingURL=loadVitals.js.map
//# debugId=f98a05b1-173e-5eba-9940-954630df819a
