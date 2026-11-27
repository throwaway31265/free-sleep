// Autopilot decision engine. Pure: every input is passed in, nothing here touches I/O.
// Autopilot never picks a temperature; it only nudges an offset around the anchor (the last
// value set by a person or the schedule) and always falls back toward the anchor on bad data.
import { AUTOPILOT_HARD_MAX_OFFSET_F, AUTOPILOT_HARD_MAX_STEP_F, AUTOPILOT_HARD_MIN_GAP_MIN, AUTOPILOT_MAX_WRITES_PER_NIGHT, } from '../db/settingsSchema.js';
import moment from 'moment-timezone';
export const ENV_STALE_S = 180;
export const SETTLE_MIN = 15;
export const HOOK_WINDOW_MIN = 6;
export const SAT = 0.98;
export const RETURN_GAP_MIN = 10;
export const MIN_REMAINING_S = 600;
export const FAULT_AFTER_FAILURES = 3;
export const UNKNOWN_ANCHOR_HOLD_MIN = 15;
export const RESTORE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
export const DEVICE_MIN_F = 55;
export const DEVICE_MAX_F = 110;
const MINUTE_MS = 60 * 1000;
const clampNumber = (value, low, high) => Math.min(high, Math.max(low, value));
// Rounds and normalizes -0 to 0
const toInt = (value) => Math.round(value) + 0;
const signedInt = (value) => (value > 0 ? `+${value}` : `${value}`);
const signedOneDecimal = (value) => (value >= 0 ? `+${value.toFixed(1)}` : value.toFixed(1));
export const effectiveMaxOffset = (cfg) => Math.max(0, Math.min(cfg.maxOffsetF, AUTOPILOT_HARD_MAX_OFFSET_F));
// User absolute limits, swapped if inverted and kept inside the device range
export function absoluteBounds(cfg) {
    const low = Math.min(cfg.absoluteMinF, cfg.absoluteMaxF);
    const high = Math.max(cfg.absoluteMinF, cfg.absoluteMaxF);
    return {
        low: clampNumber(low, DEVICE_MIN_F, DEVICE_MAX_F),
        high: clampNumber(high, DEVICE_MIN_F, DEVICE_MAX_F),
    };
}
// Final integer target. Absolute limits only restrict movement away from the anchor, so the
// result always lies between the anchor and the requested value and within 55..110 F.
export function clampFinal(cfg, anchorF, valueF) {
    const { low, high } = absoluteBounds(cfg);
    const anchorInRange = clampNumber(Math.round(anchorF), DEVICE_MIN_F, DEVICE_MAX_F);
    const lower = Math.min(low, anchorInRange);
    const upper = Math.max(high, anchorInRange);
    return toInt(clampNumber(Math.round(valueF), lower, upper));
}
// Only the fields that changed, so the caller can apply them on top of fresher runtime state
function diffRuntime(before, after) {
    const patch = {};
    Object.keys(after).forEach((key) => {
        if (key === 'log')
            return;
        if (before[key] !== after[key])
            patch[key] = after[key];
    });
    return patch;
}
const formatClock = (epochMs, timeZone) => moment.tz(epochMs, timeZone).format('HH:mm');
function idleReason(device, alarmVibrating) {
    if (!device.isOn)
        return 'side is off';
    if (device.isPriming)
        return 'pod is priming';
    if (alarmVibrating)
        return 'alarm is vibrating';
    if (device.secondsRemaining < MIN_REMAINING_S)
        return 'less than 10 min of run time left';
    return null;
}
/**
 * Runs one autopilot tick: guards (off/away/device/idle), anchor bookkeeping, hold/pause/settle,
 * then the room/wake/sleep rules, the saturation guard, rate limiting and final clamping.
 */
export function decide(input) {
    const { now, cfg, rt, device } = input;
    const next = { ...rt };
    const noRules = { room: 0, wake: 0, sleep: 0 };
    // Builds an output that makes no write
    const skip = (state, reason, sentence, extra) => {
        next.state = state;
        return {
            state,
            newF: null,
            desiredOffset: 0,
            step: 0,
            rules: noRules,
            degraded: [],
            skippedBecause: reason,
            sentence,
            ...extra,
            rtPatch: diffRuntime(rt, next),
        };
    };
    // 1. Kill switch
    if (!cfg.enabled)
        return skip('OFF', 'disabled', 'Autopilot is off');
    // 2. Away mode on either side controls both sides, so never act
    if (input.awayAny)
        return skip('IDLE', 'away', 'Away mode is on; autopilot idle');
    // 3. Device read failed
    if (device === null) {
        next.failCount = rt.failCount + 1;
        const state = next.failCount >= FAULT_AFTER_FAILURES ? 'FAULT' : rt.state;
        return skip(state, 'device read failed', `Could not read the pod (${next.failCount} in a row); no change`);
    }
    next.failCount = 0;
    // 4. Side off, priming, alarm or about to turn off. Only power-off ends the night; for the
    // other reasons the device still holds anchor + offset, so keep both and resume against them.
    const reason = idleReason(device, input.alarmVibrating);
    if (reason) {
        if (!device.isOn) {
            next.appliedOffset = 0;
            next.offsetIsVirtual = false;
            next.anchorF = null;
            next.anchorSource = null;
            next.nightKey = null;
        }
        return skip('IDLE', reason, `Idle: ${reason}`);
    }
    // New night: the night key was cleared at power-off
    if (next.nightKey === null) {
        next.nightKey = input.localDateKey;
        next.writesTonight = 0;
        next.nightRefC = null;
    }
    // A shadow-only offset never reached the device, so it means nothing in active mode
    if (cfg.mode === 'active' && next.offsetIsVirtual) {
        next.appliedOffset = 0;
        next.offsetIsVirtual = false;
    }
    const env = input.env;
    const ambientC = env?.ambientC ?? null;
    const roomValid = env !== null && ambientC !== null && env.ageS <= ENV_STALE_S && env.ambientValid
        && ambientC >= 5 && ambientC <= 40;
    // 5. No anchor yet (first tick after power-on or boot)
    if (next.anchorF === null) {
        const snapshot = input.restored;
        const canRestore = snapshot !== null && snapshot.lastWrittenF === device.targetF && now - snapshot.savedAt < RESTORE_MAX_AGE_MS;
        if (canRestore) {
            next.anchorF = snapshot.anchorF;
            next.anchorSource = snapshot.anchorSource ?? 'unknown';
            next.anchorAt = snapshot.anchorAt;
            next.appliedOffset = snapshot.appliedOffset;
            next.lastWrittenF = snapshot.lastWrittenF;
        }
        else {
            next.anchorF = device.targetF;
            next.anchorSource = 'unknown';
            next.anchorAt = now;
            next.appliedOffset = 0;
            next.holdUntil = now + UNKNOWN_ANCHOR_HOLD_MIN * MINUTE_MS;
            return skip('HOLD', 'new anchor', `Anchored at ${device.targetF} F; holding ${UNKNOWN_ANCHOR_HOLD_MIN} min before adjusting`);
        }
    }
    const anchorF = next.anchorF;
    // A real offset with the device sitting exactly on the anchor means something (e.g. a schedule
    // write while autopilot was not applying) already removed it; never step from a phantom offset.
    if (!next.offsetIsVirtual && next.appliedOffset !== 0 && device.targetF === anchorF) {
        next.appliedOffset = 0;
    }
    // 6. Someone changed the temperature outside of free-sleep's hooks: treat it as manual
    const hookRecent = next.lastHookAt !== null && now - next.lastHookAt < HOOK_WINDOW_MIN * MINUTE_MS;
    const expectedF = clampFinal(cfg, anchorF, anchorF + next.appliedOffset);
    const isExternal = device.targetF !== next.lastWrittenF && device.targetF !== anchorF && device.targetF !== expectedF;
    if (isExternal && !hookRecent) {
        next.anchorF = device.targetF;
        next.anchorSource = 'unknown';
        next.anchorAt = now;
        next.appliedOffset = 0;
        next.offsetIsVirtual = false;
        next.holdUntil = now + cfg.manualHoldMinutes * MINUTE_MS;
        if (roomValid)
            next.nightRefC = ambientC;
        const holdClock = formatClock(next.holdUntil, input.timeZone);
        return skip('HOLD', 'external change', `Temperature changed to ${device.targetF} F outside the app; new anchor, holding until ${holdClock}`);
    }
    // 7. Pause and hold
    if (next.pausedUntil !== null) {
        if (next.pausedUntil > now)
            return skip('PAUSED', 'paused', `Paused until ${formatClock(next.pausedUntil, input.timeZone)}`);
        next.pausedUntil = null;
    }
    if (next.holdUntil !== null) {
        if (next.holdUntil > now)
            return skip('HOLD', 'hold', `Holding after a change until ${formatClock(next.holdUntil, input.timeZone)}`);
        next.holdUntil = null;
    }
    // 8. Let a fresh schedule change settle before nudging it
    if (next.anchorSource === 'schedule' && next.anchorAt !== null && now - next.anchorAt < SETTLE_MIN * MINUTE_MS && next.appliedOffset === 0) {
        return skip('SETTLING', 'settling', `Schedule set ${anchorF} F; settling for ${SETTLE_MIN} min`);
    }
    // 9. Rules
    const degraded = [];
    const rules = { room: 0, wake: 0, sleep: 0 };
    const sentenceParts = [];
    const enabledDegradableRules = [];
    // 9a. Room compensation: a warmer room than the reference cools the bed, and vice versa
    if (cfg.room.enabled) {
        enabledDegradableRules.push('room');
        if (roomValid && ambientC !== null) {
            if (next.nightRefC === null)
                next.nightRefC = ambientC;
            const refC = cfg.room.referenceC ?? next.nightRefC;
            const deltaC = ambientC - refC;
            const excessC = Math.abs(deltaC) - cfg.room.deadbandC;
            rules.room = excessC <= 0 ? 0 : toInt(-Math.sign(deltaC) * Math.round(cfg.room.gainFPerC * excessC));
            sentenceParts.push(`Room ${ambientC.toFixed(1)} C (${signedOneDecimal(deltaC)} vs ${refC.toFixed(1)} ref) → ${signedInt(rules.room)} F`);
        }
        else {
            degraded.push('room');
            sentenceParts.push('Room data unavailable → 0 F');
        }
    }
    // 9b. Wake warm-up in the minutes before the alarm / power-off
    if (cfg.wakeWarmup.enabled) {
        const wakeTime = input.wakeTimeMs;
        if (wakeTime !== null && now >= wakeTime - cfg.wakeWarmup.minutes * MINUTE_MS && now <= wakeTime) {
            rules.wake = cfg.wakeWarmup.deltaF;
        }
        sentenceParts.push(`wake ${signedInt(rules.wake)}`);
    }
    // 9c. Sleep-based cooling from heart rate (experimental)
    if (cfg.vitals.enabled) {
        enabledDegradableRules.push('vitals');
        const vitals = input.vitals;
        const vitalsValid = vitals !== null && vitals.nBase >= 15 && vitals.nRecent >= 10
            && vitals.newestAgeS !== null && vitals.newestAgeS <= 360
            && vitals.baselineHR !== null && vitals.recentHR !== null;
        if (vitalsValid && vitals.recentHR <= vitals.baselineHR - cfg.vitals.hrDropBpm) {
            rules.sleep = cfg.vitals.deltaF;
        }
        else if (!vitalsValid) {
            degraded.push('vitals');
        }
        sentenceParts.push(`sleep ${signedInt(rules.sleep)}`);
    }
    // 9d. Clamp to the configured and hard max offset
    const maxOffset = effectiveMaxOffset(cfg);
    const applied = next.appliedOffset;
    let desired = toInt(clampNumber(rules.room + rules.wake + rules.sleep, -maxOffset, maxOffset));
    // 9e. Saturation: if the pod has been running flat out for 15 min, pushing further does nothing
    const coolingSaturated = input.thermPowerMax15 !== null && input.thermPowerMax15 <= -SAT;
    const heatingSaturated = input.thermPowerMin15 !== null && input.thermPowerMin15 >= SAT;
    if ((coolingSaturated && desired < applied) || (heatingSaturated && desired > applied)) {
        desired = applied;
        sentenceParts.push(coolingSaturated ? 'cooling saturated' : 'heating saturated');
    }
    // 9f. Nothing trustworthy left: return to the anchor
    if (enabledDegradableRules.length > 0 && enabledDegradableRules.every((rule) => degraded.includes(rule))) {
        desired = 0;
    }
    const activeState = cfg.mode === 'shadow' ? 'SHADOW' : 'ACTIVE';
    const summary = sentenceParts.length > 0 ? `${sentenceParts.join('; ')}; ` : '';
    const ruleResult = { desiredOffset: desired, rules, degraded };
    // 10. Rate limit
    const stepLimit = Math.max(0, Math.min(cfg.stepF, AUTOPILOT_HARD_MAX_STEP_F));
    const difference = desired - applied;
    const step = toInt(Math.sign(difference) * Math.min(stepLimit, Math.abs(difference)));
    if (step === 0) {
        return skip(activeState, 'at desired offset', `${summary}no change (anchor ${anchorF}, offset ${signedInt(applied)})`, ruleResult);
    }
    if (next.writesTonight >= AUTOPILOT_MAX_WRITES_PER_NIGHT) {
        return skip(activeState, 'nightly write limit', `${summary}nightly limit of ${AUTOPILOT_MAX_WRITES_PER_NIGHT} changes reached`, { ...ruleResult, step });
    }
    if (next.lastWriteAt !== null) {
        const movingTowardAnchor = Math.abs(applied + step) < Math.abs(applied);
        const fastReturn = degraded.length > 0 && movingTowardAnchor;
        const requiredGapMin = fastReturn ? RETURN_GAP_MIN : Math.max(cfg.minMinutesBetweenChanges, AUTOPILOT_HARD_MIN_GAP_MIN);
        const elapsedMin = (now - next.lastWriteAt) / MINUTE_MS;
        if (elapsedMin < requiredGapMin) {
            const waitMin = Math.ceil(requiredGapMin - elapsedMin);
            return skip(activeState, 'min gap', `${summary}waiting ${waitMin} min before the next change`, { ...ruleResult, step });
        }
    }
    // 11. Final clamp
    const newF = clampFinal(cfg, anchorF, anchorF + applied + step);
    const currentF = cfg.mode === 'shadow' ? clampFinal(cfg, anchorF, anchorF + applied) : device.targetF;
    if (newF === currentF) {
        return skip(activeState, 'at limit', `${summary}already at ${newF} F (absolute limit)`, { ...ruleResult, step });
    }
    const newOffset = newF - anchorF;
    // 12. Shadow mode tracks a virtual offset so it behaves exactly like active mode, minus the write
    next.state = activeState;
    next.appliedOffset = newOffset;
    if (cfg.mode === 'shadow') {
        next.offsetIsVirtual = true;
        next.lastWriteAt = now;
        next.writesTonight += 1;
        return {
            state: 'SHADOW', newF: null, step, skippedBecause: null, ...ruleResult,
            sentence: `${summary}would set ${newF} F (anchor ${anchorF}, offset ${signedInt(newOffset)})`,
            rtPatch: diffRuntime(rt, next),
        };
    }
    next.offsetIsVirtual = false;
    return {
        state: 'ACTIVE', newF, step, skippedBecause: null, ...ruleResult,
        sentence: `${summary}wrote ${newF} F (anchor ${anchorF}, offset ${signedInt(newOffset)})`,
        rtPatch: diffRuntime(rt, next),
    };
}
//# sourceMappingURL=decide.js.map