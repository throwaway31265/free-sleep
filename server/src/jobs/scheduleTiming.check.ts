// Checks for mapping an alarm's calendar day/time back to the schedule night that owns it.
// Run: cd server && npm run check:alarm
import assert from 'node:assert/strict';

import { DAYS_OF_WEEK, getScheduleDayForAlarm } from './scheduleTiming.js';
import type { DayOfWeek } from '../db/schedulesSchema.js';

type Daily = { power: { on: string }; alarm: { enabled: boolean } };
const week = (enabledDays: string[], powerOn = '22:00'): Record<DayOfWeek, Daily> =>
  Object.fromEntries(DAYS_OF_WEEK.map((day) => [
    day, { power: { on: powerOn }, alarm: { enabled: enabledDays.includes(day) } },
  ])) as Record<DayOfWeek, Daily>;

const sunToThu = week(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday']);

// Friday 07:00 / 08:30 / 11:20 alarms belong to thursday night (the bug: they used friday's disabled entry).
assert.equal(getScheduleDayForAlarm('friday', '07:00', sunToThu), 'thursday');
assert.equal(getScheduleDayForAlarm('friday', '08:30', sunToThu), 'thursday');
assert.equal(getScheduleDayForAlarm('friday', '11:20', sunToThu), 'thursday');
// Monday morning wraps to sunday night.
assert.equal(getScheduleDayForAlarm('monday', '07:00', sunToThu), 'sunday');
// Saturday morning: friday night owns it even though its alarm is disabled.
assert.equal(getScheduleDayForAlarm('saturday', '07:00', sunToThu), 'friday');
// A time after power-on belongs to the same day's night.
assert.equal(getScheduleDayForAlarm('friday', '23:00', sunToThu), 'friday');
// Power-on in the morning: an 11:20 alarm is after power-on, so it is the same day's.
assert.equal(getScheduleDayForAlarm('friday', '11:20', week(['friday'], '09:00')), 'friday');

console.warn('scheduleTiming checks passed');
