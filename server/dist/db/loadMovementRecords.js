
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="65e69c1b-7833-55ff-806b-9e3165c41f0d")}catch(e){}}();
import settingsDB from './settings.js';
import moment from 'moment-timezone';
export const loadMovementRecords = async (movementRecords) => {
    await settingsDB.read();
    const userTimeZone = settingsDB.data.timeZone || 'UTC';
    // Parse JSON fields
    return movementRecords.map((record) => ({
        ...record,
        timestamp: moment.tz(record.timestamp * 1000, userTimeZone).format(),
    }));
};
//# sourceMappingURL=loadMovementRecords.js.map
//# debugId=65e69c1b-7833-55ff-806b-9e3165c41f0d
