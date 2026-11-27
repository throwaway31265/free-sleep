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