import settingsDB from './settings.js';
import moment from 'moment-timezone';
export const loadSleepRecords = async (sleepRecords) => {
    await settingsDB.read();
    const userTimeZone = settingsDB.data.timeZone || 'UTC';
    // Parse JSON fields
    return sleepRecords.map((record) => ({
        ...record,
        entered_bed_at: moment.tz(record.entered_bed_at * 1000, userTimeZone).format(),
        left_bed_at: moment.tz(record.left_bed_at * 1000, userTimeZone).format(),
        present_intervals: record.present_intervals
            ? JSON.parse(record.present_intervals).map(([start, end]) => [
                moment.tz(start * 1000, userTimeZone).format(),
                moment.tz(end * 1000, userTimeZone).format(),
            ])
            : [],
        not_present_intervals: record.not_present_intervals
            ? JSON.parse(record.not_present_intervals).map(([start, end]) => [
                moment.tz(start * 1000, userTimeZone).format(),
                moment.tz(end * 1000, userTimeZone).format(),
            ])
            : [],
    }));
};
