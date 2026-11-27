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