
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="57194eb6-5b68-5322-93dc-c84880780cce")}catch(e){}}();
export const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export function getDayOfWeekIndex(day) {
    return DAYS_OF_WEEK.indexOf(day);
}
// Times before power-on belong to the following day, including after noon.
export function getDayIndexForSchedule(scheduleDay, time, powerOnTime) {
    const dayIndex = getDayOfWeekIndex(scheduleDay);
    return time < powerOnTime ? (dayIndex + 1) % DAYS_OF_WEEK.length : dayIndex;
}
//# sourceMappingURL=scheduleTiming.js.map
//# debugId=57194eb6-5b68-5322-93dc-c84880780cce
