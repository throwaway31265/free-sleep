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
