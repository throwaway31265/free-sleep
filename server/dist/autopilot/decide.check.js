// Table-driven checks for the autopilot decision engine and wake-time math.
// Run: cd server && npm run check:autopilot
import assert from 'node:assert/strict';
import moment from 'moment-timezone';
import { decide } from './decide.js';
import { getCurrentNight, getWakeTime } from './baseline.js';
import { createDefaultRuntime } from './types.js';
const MINUTE = 60 * 1000;
const NOW = Date.UTC(2026, 10, 26, 3, 0, 0); // 2026-11-26 03:00 UTC
const baseConfig = () => ({
    enabled: true,
    mode: 'active',
    maxOffsetF: 3,
    stepF: 1,
    minMinutesBetweenChanges: 20,
    manualHoldMinutes: 180,
    absoluteMinF: 55,
    absoluteMaxF: 110,
    room: { enabled: true, referenceC: null, gainFPerC: 1, deadbandC: 0.5 },
    wakeWarmup: { enabled: false, minutes: 30, deltaF: 2 },
    vitals: { enabled: false, hrDropBpm: 6, deltaF: -1 },
});
// A side that has been running steadily: anchor 62 from the schedule an hour ago, no offset yet
const steadyRuntime = (overrides = {}) => ({
    ...createDefaultRuntime(),
    state: 'ACTIVE',
    anchorF: 62,
    anchorSource: 'schedule',
    anchorAt: NOW - 60 * MINUTE,
    nightRefC: 21.5,
    nightKey: '2026-11-25',
    lastHookAt: NOW - 60 * MINUTE,
    ...overrides,
});
function makeInput(overrides = {}) {
    const { cfg, device, env, ...rest } = overrides;
    return {
        now: NOW,
        cfg: { ...baseConfig(), ...cfg },
        awayAny: false,
        device: device === null ? null : { isOn: true, isPriming: false, targetF: 62, secondsRemaining: 30_000, ...device },
        alarmVibrating: false,
        rt: steadyRuntime(),
        env: env === null ? null : { ambientC: 21.5, humidity: 50, ageS: 30, ambientValid: true, ...env },
        thermPowerMin15: null,
        thermPowerMax15: null,
        wakeTimeMs: null,
        vitals: null,
        timeZone: 'UTC',
        localDateKey: '2026-11-25',
        restored: null,
        ...rest,
    };
}
const dailySchedule = (overrides = {}) => ({
    temperatures: {},
    power: { on: '22:00', off: '07:00', onTemperature: 70, enabled: true, ...overrides.power },
    alarm: {
        time: '06:30', vibrationIntensity: 50, vibrationPattern: 'rise', duration: 10, enabled: true, alarmTemperature: 80,
        ...overrides.alarm,
    },
});
const makeSchedules = (daily) => {
    const week = { sunday: daily, monday: daily, tuesday: daily, wednesday: daily, thursday: daily, friday: daily, saturday: daily };
    return { left: week, right: week };
};
const makeSettings = (timeZone) => {
    const side = {
        name: 'Left',
        awayMode: false,
        scheduleOverrides: {
            temperatureSchedules: { disabled: false, expiresAt: '' },
            alarm: { disabled: false, timeOverride: '', expiresAt: '' },
        },
        taps: {
            doubleTap: { type: 'temperature', change: 'decrement', amount: 1 },
            tripleTap: { type: 'temperature', change: 'increment', amount: 1 },
            quadTap: { type: 'alarm', behavior: 'dismiss', snoozeDuration: 60, inactiveAlarmBehavior: 'power' },
        },
        autopilot: baseConfig(),
    };
    return {
        id: 'check', timeZone, left: side, right: side, primePodDaily: { enabled: false, time: '14:00' },
        temperatureFormat: 'fahrenheit', rebootDaily: false,
    };
};
const cases = [
    {
        name: '1. away mode on the other side -> IDLE, no write',
        run: () => {
            const output = decide(makeInput({ awayAny: true, env: { ambientC: 25 } }));
            assert.equal(output.state, 'IDLE');
            assert.equal(output.newF, null);
        },
    },
    {
        name: '2. side off -> IDLE and the night resets; priming / alarm / <600 s -> IDLE, anchor and offset kept',
        run: () => {
            const offOutput = decide(makeInput({ device: { isOn: false }, rt: steadyRuntime({ appliedOffset: -2, lastWrittenF: 60 }) }));
            assert.equal(offOutput.state, 'IDLE');
            assert.equal(offOutput.newF, null);
            assert.equal(offOutput.rtPatch.appliedOffset, 0);
            assert.equal(offOutput.rtPatch.anchorF, null);
            assert.equal(offOutput.rtPatch.nightKey, null);
            const pauses = [
                { device: { isPriming: true, targetF: 60 } },
                { alarmVibrating: true, device: { targetF: 60 } },
                { device: { secondsRemaining: 599, targetF: 60 } },
            ];
            pauses.forEach((variant) => {
                const output = decide(makeInput({ ...variant, rt: steadyRuntime({ appliedOffset: -2, lastWrittenF: 60 }) }));
                assert.equal(output.state, 'IDLE');
                assert.equal(output.newF, null);
                assert.equal(output.rtPatch.appliedOffset, undefined);
                assert.equal(output.rtPatch.anchorF, undefined);
                assert.equal(output.rtPatch.nightKey, undefined);
            });
        },
    },
    {
        name: '2b. resuming after an alarm keeps the original anchor (offset never folds into it)',
        run: () => {
            const runtime = steadyRuntime({ anchorF: 72, appliedOffset: -3, lastWrittenF: 69, lastWriteAt: NOW - 60 * MINUTE, writesTonight: 5 });
            const during = decide(makeInput({ alarmVibrating: true, device: { targetF: 69 }, env: { ambientC: 30 }, rt: runtime }));
            assert.equal(during.state, 'IDLE');
            const afterRuntime = { ...runtime, ...during.rtPatch };
            const after = decide(makeInput({ now: NOW + 5 * MINUTE, device: { targetF: 69 }, env: { ambientC: 30 }, rt: afterRuntime }));
            assert.notEqual(after.skippedBecause, 'new anchor');
            assert.equal(after.rtPatch.anchorF, undefined);
            assert.equal(after.rtPatch.writesTonight, undefined);
            assert.equal(after.desiredOffset, -3);
            assert.equal(after.newF, null); // already at the -3 cap relative to 72
        },
    },
    {
        name: '2c. stale offset with the device on the anchor (schedule write while paused/fault) -> no phantom step',
        run: () => {
            const runtime = steadyRuntime({
                anchorF: 68, anchorAt: NOW - 30 * MINUTE, appliedOffset: -2, lastWrittenF: 70, lastWriteAt: NOW - 90 * MINUTE,
                pausedUntil: NOW - MINUTE,
            });
            const atReference = decide(makeInput({ device: { targetF: 68 }, rt: runtime }));
            assert.equal(atReference.newF, null);
            assert.equal(atReference.rtPatch.appliedOffset, 0);
            const stillWarm = decide(makeInput({ device: { targetF: 68 }, env: { ambientC: 24 }, rt: runtime }));
            assert.equal(stillWarm.desiredOffset, -2);
            assert.equal(stillWarm.newF, 67); // steps from 0, not from the phantom -2
        },
    },
    {
        name: '3. room +2.4 C -> desired -2, step -1, then blocked by the 20 min gap',
        run: () => {
            const first = decide(makeInput({ env: { ambientC: 23.9 } }));
            assert.equal(first.rules.room, -2);
            assert.equal(first.desiredOffset, -2);
            assert.equal(first.step, -1);
            assert.equal(first.newF, 61);
            assert.equal(first.state, 'ACTIVE');
            assert.equal(first.rtPatch.appliedOffset, -1);
            const second = decide(makeInput({
                now: NOW + 5 * MINUTE,
                env: { ambientC: 23.9 },
                device: { targetF: 61 },
                rt: steadyRuntime({ appliedOffset: -1, lastWrittenF: 61, lastWriteAt: NOW, writesTonight: 1 }),
            }));
            assert.equal(second.newF, null);
            assert.equal(second.skippedBecause, 'min gap');
        },
    },
    {
        name: '4. clamp at maxOffsetF, and at 5 even if the config is forced higher',
        run: () => {
            const clamped = decide(makeInput({ env: { ambientC: 30 } }));
            assert.equal(clamped.desiredOffset, -3);
            const forced = decide(makeInput({ cfg: { maxOffsetF: 9, stepF: 9 }, env: { ambientC: 33 } }));
            assert.equal(forced.desiredOffset, -5);
            assert.equal(forced.step, -2); // hard step limit
            assert.equal(forced.newF, 60);
            const atLimit = decide(makeInput({
                cfg: { maxOffsetF: 9, stepF: 9 },
                env: { ambientC: 33 },
                device: { targetF: 57 },
                rt: steadyRuntime({ appliedOffset: -5, lastWrittenF: 57, lastWriteAt: NOW - 60 * MINUTE }),
            }));
            assert.equal(atLimit.desiredOffset, -5);
            assert.equal(atLimit.newF, null);
        },
    },
    {
        name: '5. stale env (181 s) -> desired 0 with the faster 10 min return',
        run: () => {
            const output = decide(makeInput({
                env: { ambientC: 25, ageS: 181 },
                device: { targetF: 60 },
                rt: steadyRuntime({ appliedOffset: -2, lastWrittenF: 60, lastWriteAt: NOW - 12 * MINUTE }),
            }));
            assert.deepEqual(output.degraded, ['room']);
            assert.equal(output.desiredOffset, 0);
            assert.equal(output.step, 1);
            assert.equal(output.newF, 61);
            const tooSoon = decide(makeInput({
                env: { ambientC: 25, ageS: 181 },
                device: { targetF: 60 },
                rt: steadyRuntime({ appliedOffset: -2, lastWrittenF: 60, lastWriteAt: NOW - 8 * MINUTE }),
            }));
            assert.equal(tooSoon.newF, null);
            assert.equal(tooSoon.skippedBecause, 'min gap');
        },
    },
    {
        name: '6. glitch (ambientValid=false) -> room 0',
        run: () => {
            const output = decide(makeInput({ env: { ambientC: 26, ambientValid: false } }));
            assert.equal(output.rules.room, 0);
            assert.ok(output.degraded.includes('room'));
            assert.equal(output.newF, null);
        },
    },
    {
        name: '7. external change -> HOLD and re-anchored',
        run: () => {
            const output = decide(makeInput({
                device: { targetF: 66 },
                rt: steadyRuntime({ appliedOffset: -1, lastWrittenF: 61, lastWriteAt: NOW - 30 * MINUTE }),
            }));
            assert.equal(output.state, 'HOLD');
            assert.equal(output.rtPatch.anchorF, 66);
            assert.equal(output.rtPatch.anchorSource, 'unknown');
            assert.equal(output.rtPatch.appliedOffset, 0);
            assert.equal(output.rtPatch.holdUntil, NOW + 180 * MINUTE);
        },
    },
    {
        name: '8. hook within 6 min -> not treated as external',
        run: () => {
            const output = decide(makeInput({
                device: { targetF: 66 },
                rt: steadyRuntime({ anchorF: 64, anchorSource: 'manual', lastHookAt: NOW - 2 * MINUTE, lastWrittenF: 61 }),
            }));
            assert.notEqual(output.skippedBecause, 'external change');
            assert.equal(output.rtPatch.anchorF, undefined);
        },
    },
    {
        name: '9. saturation guard blocks further cooling but allows warming',
        run: () => {
            const blocked = decide(makeInput({
                env: { ambientC: 25 },
                thermPowerMin15: -1,
                thermPowerMax15: -0.99,
                device: { targetF: 61 },
                rt: steadyRuntime({ appliedOffset: -1, lastWrittenF: 61, lastWriteAt: NOW - 60 * MINUTE }),
            }));
            assert.equal(blocked.desiredOffset, -1);
            assert.equal(blocked.newF, null);
            const warming = decide(makeInput({
                env: { ambientC: 21.5 },
                thermPowerMin15: -1,
                thermPowerMax15: -0.99,
                device: { targetF: 60 },
                rt: steadyRuntime({ appliedOffset: -2, lastWrittenF: 60, lastWriteAt: NOW - 60 * MINUTE }),
            }));
            assert.equal(warming.desiredOffset, 0);
            assert.equal(warming.newF, 61);
        },
    },
    {
        name: '10. wake window with the next-day rule: power.on 22:00, alarm 06:30, now 06:10 -> +2',
        run: () => {
            const settings = makeSettings('America/New_York');
            const schedules = makeSchedules(dailySchedule());
            const now = moment.tz('2026-11-26 06:10', 'YYYY-MM-DD HH:mm', 'America/New_York').valueOf();
            const wakeTimeMs = getWakeTime('left', settings, schedules, now);
            assert.equal(wakeTimeMs, moment.tz('2026-11-26 06:30', 'YYYY-MM-DD HH:mm', 'America/New_York').valueOf());
            const output = decide(makeInput({
                now,
                cfg: { room: { ...baseConfig().room, enabled: false }, wakeWarmup: { enabled: true, minutes: 30, deltaF: 2 }, stepF: 2 },
                wakeTimeMs,
                rt: steadyRuntime({ anchorAt: now - 120 * MINUTE }),
            }));
            assert.equal(output.rules.wake, 2);
            assert.equal(output.desiredOffset, 2);
            assert.equal(output.newF, 64);
        },
    },
    {
        name: '11. absoluteMin/Max inverted -> swapped',
        run: () => {
            const output = decide(makeInput({
                cfg: { absoluteMinF: 70, absoluteMaxF: 65 },
                device: { targetF: 66 },
                env: { ambientC: 30 },
                rt: steadyRuntime({ anchorF: 66, lastWrittenF: 66 }),
            }));
            assert.equal(output.newF, 65);
            const blocked = decide(makeInput({
                cfg: { absoluteMinF: 70, absoluteMaxF: 65 },
                device: { targetF: 65 },
                env: { ambientC: 30 },
                rt: steadyRuntime({ anchorF: 66, appliedOffset: -1, lastWrittenF: 65, lastWriteAt: NOW - 60 * MINUTE }),
            }));
            assert.equal(blocked.newF, null);
            assert.equal(blocked.skippedBecause, 'at limit');
        },
    },
    {
        name: '12. final value always within 55..110 and an integer',
        run: () => {
            const extremes = [
                { anchorF: 55, ambientC: 35 },
                { anchorF: 110, ambientC: 10 },
                { anchorF: 56, ambientC: 30 },
                { anchorF: 109, ambientC: 15 },
            ];
            extremes.forEach(({ anchorF, ambientC }) => {
                const output = decide(makeInput({
                    cfg: { maxOffsetF: 5, stepF: 2, room: { enabled: true, referenceC: 21.5, gainFPerC: 1.37, deadbandC: 0.13 } },
                    device: { targetF: anchorF },
                    env: { ambientC },
                    rt: steadyRuntime({ anchorF, lastWrittenF: anchorF }),
                }));
                if (output.newF !== null) {
                    assert.ok(Number.isInteger(output.newF), `integer: ${output.newF}`);
                    assert.ok(output.newF >= 55 && output.newF <= 110, `range: ${output.newF}`);
                }
            });
        },
    },
    {
        name: '13. shadow mode -> newF null and the sentence says "would set"',
        run: () => {
            const output = decide(makeInput({ cfg: { mode: 'shadow' }, env: { ambientC: 23.9 } }));
            assert.equal(output.state, 'SHADOW');
            assert.equal(output.newF, null);
            assert.match(output.sentence, /would set 61 F/);
            assert.equal(output.rtPatch.appliedOffset, -1);
            assert.equal(output.rtPatch.offsetIsVirtual, true);
        },
    },
    {
        name: '14. writesTonight 24 -> no write',
        run: () => {
            const output = decide(makeInput({ env: { ambientC: 25 }, rt: steadyRuntime({ writesTonight: 24 }) }));
            assert.equal(output.newF, null);
            assert.equal(output.skippedBecause, 'nightly write limit');
        },
    },
    {
        name: 'baseline: DST spring forward (America/New_York, 2026-03-08)',
        run: () => {
            const settings = makeSettings('America/New_York');
            const schedules = makeSchedules(dailySchedule());
            const now = Date.UTC(2026, 2, 8, 9, 0); // 05:00 EDT
            assert.equal(getWakeTime('left', settings, schedules, now), Date.UTC(2026, 2, 8, 10, 30)); // 06:30 EDT
            assert.equal(getCurrentNight('left', settings, schedules, now)?.powerOnMs, Date.UTC(2026, 2, 8, 3, 0)); // 22:00 EST
        },
    },
    {
        name: 'baseline: DST fall back (America/New_York, 2026-11-01)',
        run: () => {
            const settings = makeSettings('America/New_York');
            const schedules = makeSchedules(dailySchedule());
            const now = Date.UTC(2026, 10, 1, 10, 0); // 05:00 EST
            assert.equal(getWakeTime('left', settings, schedules, now), Date.UTC(2026, 10, 1, 11, 30)); // 06:30 EST
        },
    },
    {
        name: 'baseline: just after midnight belongs to the previous night',
        run: () => {
            const settings = makeSettings('UTC');
            const schedules = makeSchedules(dailySchedule({ power: { on: '23:30' }, alarm: { time: '07:00' } }));
            const now = Date.UTC(2026, 10, 26, 0, 15);
            assert.equal(getCurrentNight('left', settings, schedules, now)?.powerOnMs, Date.UTC(2026, 10, 25, 23, 30));
            assert.equal(getWakeTime('left', settings, schedules, now), Date.UTC(2026, 10, 26, 7, 0));
        },
    },
    {
        name: 'baseline: alarm disabled falls back to power.off; power disabled -> null',
        run: () => {
            const settings = makeSettings('UTC');
            const now = Date.UTC(2026, 10, 26, 2, 0);
            const noAlarm = makeSchedules(dailySchedule({ alarm: { enabled: false } }));
            assert.equal(getWakeTime('left', settings, noAlarm, now), Date.UTC(2026, 10, 26, 7, 0));
            const noPower = makeSchedules(dailySchedule({ power: { enabled: false } }));
            assert.equal(getWakeTime('left', settings, noPower, now), null);
        },
    },
];
let failures = 0;
cases.forEach(({ name, run }) => {
    try {
        run();
        console.warn(`PASS ${name}`);
    }
    catch (error) {
        failures++;
        console.error(`FAIL ${name}\n  ${error instanceof Error ? error.message : String(error)}`);
    }
});
console.warn(`\n${cases.length - failures}/${cases.length} checks passed`);
if (failures > 0)
    process.exit(1);
//# sourceMappingURL=decide.check.js.map