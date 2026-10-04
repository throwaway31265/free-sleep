// Run with Node 24: node --test tests/scheduling.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { isPowerScheduleDurationValid } from '../app/src/pages/SchedulePage/scheduleValidation.ts';
import { DAYS_OF_WEEK, getDayIndexForSchedule } from '../server/src/jobs/scheduleTiming.ts';

const requireServer = createRequire(new URL('../server/package.json', import.meta.url));
const { RecurrenceRule } = requireServer('node-schedule');

test('power schedules accept any duration under 24 hours, during the day or overnight', () => {
  const cases = [
    ['22:30', '09:00', true],
    ['21:00', '09:00', true],
    ['21:00', '10:00', true],
    ['21:00', '11:00', true],
    ['23:15', '13:15', true],
    ['23:59', '13:59', true],
    ['06:00', '20:00', true],
    ['00:00', '14:00', true],
    ['23:59', '00:00', true],
    ['06:00', '06:01', true],
    ['21:00', '11:01', true],
    ['23:15', '13:16', true],
    ['06:00', '20:01', true],
    ['06:00', '23:00', true],
    ['21:00', '20:59', true],
    ['00:00', '23:59', true],
    ['21:00', '21:00', false],
    ['', '09:00', false],
    ['21:00', '', false],
    ['24:00', '09:00', false],
    ['21:60', '09:00', false],
  ];

  for (const [powerOn, powerOff, expected] of cases) {
    assert.equal(isPowerScheduleDurationValid(powerOn, powerOff), expected, `${powerOn} → ${powerOff}`);
  }
});

test('changing either endpoint revalidates the duration', () => {
  assert.equal(isPowerScheduleDurationValid('23:00', '13:00'), true);
  assert.equal(isPowerScheduleDurationValid('13:00', '13:00'), false);
  assert.equal(isPowerScheduleDurationValid('13:00', '12:59'), true);
});

test('power-off, adjustments, and alarms follow the start day across the whole week', () => {
  for (const [dayIndex, day] of DAYS_OF_WEEK.entries()) {
    const nextDay = (dayIndex + 1) % 7;
    // A 23:15–13:15 schedule includes late-night and next-afternoon events.
    assert.equal(getDayIndexForSchedule(day, '23:15', '23:15'), dayIndex);
    assert.equal(getDayIndexForSchedule(day, '23:45', '23:15'), dayIndex);
    for (const time of ['00:00', '06:00', '12:59', '13:00', '13:14', '13:15']) {
      assert.equal(getDayIndexForSchedule(day, time, '23:15'), nextDay, `${day} at ${time}`);
    }
    // Existing overnight schedules and daytime schedules still resolve correctly.
    assert.equal(getDayIndexForSchedule(day, '09:00', '21:00'), nextDay);
    assert.equal(getDayIndexForSchedule(day, '08:00', '06:00'), dayIndex);
    assert.equal(getDayIndexForSchedule(day, '20:00', '06:00'), dayIndex);
    assert.equal(getDayIndexForSchedule(day, '00:30', '00:00'), dayIndex);
    assert.equal(getDayIndexForSchedule(day, '14:00', '00:00'), dayIndex);
    assert.equal(getDayIndexForSchedule(day, '20:59', '21:00'), nextDay);
  }
});

test('14-hour schedules recur at the configured local time across DST and week rollover', () => {
  const cases = [
    ['2026-03-08T07:15:00Z', '2026-03-08T20:15:00.000Z'], // Spring forward: 13 elapsed hours.
    ['2026-11-01T06:15:00Z', '2026-11-01T21:15:00.000Z'], // Fall back: 15 elapsed hours.
    ['2026-10-04T06:15:00Z', '2026-10-04T20:15:00.000Z'],
  ];

  for (const [start, expected] of cases) {
    const rule = new RecurrenceRule();
    rule.dayOfWeek = getDayIndexForSchedule('saturday', '13:15', '23:15');
    rule.hour = 13;
    rule.minute = 15;
    rule.tz = 'America/Los_Angeles';
    assert.equal(rule.nextInvocationDate(new Date(start)).toISOString(), expected);
  }
});
