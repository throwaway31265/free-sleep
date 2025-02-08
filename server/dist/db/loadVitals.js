import settingsDB from './settings.js';
import moment from 'moment-timezone';
export const loadVitals = async (vitalRecords) => {
    await settingsDB.read();
    const userTimeZone = settingsDB.data.timeZone || 'UTC';
    return vitalRecords.map((vital) => ({
        ...vital,
        period_start: moment.tz(vital.period_start * 1000, userTimeZone).format(),
    }));
};
