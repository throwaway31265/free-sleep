
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="c1352aee-45df-5b7a-9479-2f7f4b1b3135")}catch(e){}}();
import logger from '../logger.js';
import { DAYS_OF_WEEK } from './scheduleTiming.js';
export { DAYS_OF_WEEK, getDayOfWeekIndex, getDayIndexForSchedule } from './scheduleTiming.js';
export function logJob(message, side, day, dayIndex, time) {
    const endDay = DAYS_OF_WEEK[dayIndex];
    const endHour = Number(time.split(':')[0]);
    const timeOfDay = endHour < 11 ? 'morning' : 'night';
    logger.debug(`${message} for ${side} side for ${day} -> ${endDay} -- ${endDay} ${timeOfDay} @ ${time}`);
}
//# sourceMappingURL=utils.js.map
//# debugId=c1352aee-45df-5b7a-9479-2f7f4b1b3135
