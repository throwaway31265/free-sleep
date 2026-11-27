// Autopilot job: every 5 minutes per side (left at :00, right at :02) gather inputs, run decide(),
// and write at most one targetTemperatureF change. Every tick is fully guarded and never throws.
import schedule from 'node-schedule';
import moment from 'moment-timezone';

import logger from '../logger.js';
import memoryDB from '../db/memoryDB.js';
import schedulesDB from '../db/schedules.js';
import serverStatus from '../serverStatus.js';
import settingsDB from '../db/settings.js';
import type { Settings } from '../db/settingsSchema.js';
import type { Side } from '../db/schedulesSchema.js';
import type { DeviceStatus } from '../routes/deviceStatus/deviceStatusSchema.js';
import { connectFranken } from '../8sleep/frankenServer.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { getEnvironment, getThermPowerHistory } from '../routes/metrics/environment.js';
import { decide, DecideInput } from '../autopilot/decide.js';
import { getCurrentNight, getWakeTime } from '../autopilot/baseline.js';
import { loadVitalsInput, VitalsInput } from '../autopilot/vitals.js';
import {
  applyRuntimePatch,
  getRuntime,
  noteSetpoint,
  persistState,
  recordDecision,
  takeRestoredSnapshot,
} from '../autopilot/state.js';
import type { AutopilotRuntime, Decision } from '../autopilot/types.js';

const DEVICE_READ_TIMEOUT_MS = 12_000;
const SATURATION_WINDOW_MIN = 15;
// Require nearly the full window of therm samples before trusting the saturation guard
const SATURATION_MIN_COVERAGE_MIN = 14;
const SIDES: Side[] = ['left', 'right'];

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

// Per-side queue so a tick and a restore never interleave across their awaits: a restore that
// arrives mid-tick runs after the tick's write and sees it, and a tick that starts after a
// disable reads the fresh settings. Tasks must not reject (both callers catch everything).
const sideQueues: Record<Side, Promise<void>> = { left: Promise.resolve(), right: Promise.resolve() };
function runExclusive(side: Side, task: () => Promise<void>): Promise<void> {
  const run = sideQueues[side].then(task, task);
  sideQueues[side] = run.catch(() => undefined);
  return run;
}

// Autopilot owns a real offset on the device whenever one is recorded against an anchor,
// whatever state it is in (an OFF/IDLE tick must not orphan it).
const ownsDeviceOffset = (runtime: AutopilotRuntime) =>
  runtime.appliedOffset !== 0 && !runtime.offsetIsVirtual && runtime.anchorF !== null;

// One device status read with a hard timeout; null on any failure
async function readDeviceStatus(): Promise<DeviceStatus | null> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('device status read timed out')), DEVICE_READ_TIMEOUT_MS);
    });
    const read = (async () => {
      const franken = await connectFranken();
      return franken.getDeviceStatus();
    })();
    return await Promise.race([read, timeout]);
  } catch (error) {
    logger.warn(`[autopilot] device status read failed: ${errorMessage(error)}`);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Min/max thermal power over the last 15 minutes, or nulls if the window is not covered
function getThermPowerRange(side: Side, now: number) {
  const history = getThermPowerHistory(side, SATURATION_WINDOW_MIN, now);
  const oldest = history[0];
  if (!oldest || now - oldest.receivedAt < SATURATION_MIN_COVERAGE_MIN * 60 * 1000) {
    return { min: null, max: null };
  }
  const powers = history.map((entry) => entry.power);
  return { min: Math.min(...powers), max: Math.max(...powers) };
}

async function loadVitalsIfEnabled(side: Side, settings: Settings, now: number): Promise<VitalsInput | null> {
  if (!settings[side].autopilot.vitals.enabled) return null;
  try {
    const night = getCurrentNight(side, settings, schedulesDB.data, now);
    if (!night) return null;
    return await loadVitalsInput(side, night.powerOnMs, now);
  } catch (error) {
    logger.warn(`[autopilot] vitals query failed: ${errorMessage(error)}`);
    return null;
  }
}

type TickDecisionFields = Omit<Decision, 'at' | 'side' | 'anchorF' | 'appliedOffset'>;

function buildDecision(side: Side, now: number, runtime: AutopilotRuntime, fields: TickDecisionFields): Decision {
  return { at: now, side, anchorF: runtime.anchorF, appliedOffset: runtime.appliedOffset, ...fields };
}

type RestoreOptions = { turnOff: boolean; reason: string };

/**
 * Puts the anchor back on the device when autopilot stops owning the offset (disabled, switched
 * to shadow, or shutting down). Only writes if nobody touched the bed since autopilot's last write.
 * Callers must hold the side's queue (use restoreAnchor, or call from inside runTick).
 */
async function restoreAnchorNow(side: Side, { turnOff, reason }: RestoreOptions) {
  try {
    const runtime = getRuntime(side);
    const ownsOffset = ownsDeviceOffset(runtime);
    if (ownsOffset && runtime.anchorF !== null) {
      const anchorF = runtime.anchorF;
      const deviceStatus = await readDeviceStatus();
      const sideStatus = deviceStatus?.[side];
      if (sideStatus?.isOn && sideStatus.targetTemperatureF === runtime.lastWrittenF) {
        await updateDeviceStatus({ [side]: { targetTemperatureF: anchorF } });
        noteSetpoint(side, anchorF, 'autopilot');
        logger.info(`[autopilot] ${side}: restored anchor ${anchorF} F (${reason})`);
        recordDecision(side, {
          at: Date.now(), side, kind: 'restore', state: turnOff ? 'OFF' : runtime.state, anchorF, appliedOffset: 0,
          newF: anchorF, wrote: true, desiredOffset: 0, step: -runtime.appliedOffset, rules: { room: 0, wake: 0, sleep: 0 },
          degraded: [], skippedBecause: null, sentence: `Restored anchor ${anchorF} F (${reason})`,
        });
      } else {
        logger.info(`[autopilot] ${side}: not restoring anchor (${reason}); the bed is off or was changed since the last write`);
      }
    }
    if (turnOff) {
      applyRuntimePatch(side, {
        state: 'OFF', appliedOffset: 0, offsetIsVirtual: false, anchorF: null, anchorSource: null, holdUntil: null, pausedUntil: null,
      });
    } else if (ownsOffset) {
      applyRuntimePatch(side, { appliedOffset: 0 });
    }
    await persistState();
  } catch (error) {
    logger.error(`[autopilot] ${side}: restore failed: ${errorMessage(error)}`);
  }
}

function restoreAnchor(side: Side, options: RestoreOptions) {
  return runExclusive(side, () => restoreAnchorNow(side, options));
}

async function runTick(side: Side) {
  const now = Date.now();
  try {
    await settingsDB.read();
    await schedulesDB.read();
    const settings = settingsDB.data;
    const cfg = settings[side].autopilot;
    const timeZone = settings.timeZone || 'UTC';

    // Disabled while this job was still scheduled (e.g. a dropped job rebuild): undo any offset
    // here rather than waiting for restoreOnDisable, which might never run.
    if (!cfg.enabled) {
      const runtime = getRuntime(side);
      if (runtime.state !== 'OFF' || ownsDeviceOffset(runtime)) {
        await restoreAnchorNow(side, { turnOff: true, reason: 'autopilot disabled' });
      }
      return;
    }

    const deviceStatus = await readDeviceStatus();
    await memoryDB.read();
    const environment = getEnvironment(now);
    const thermRange = getThermPowerRange(side, now);
    const vitals = await loadVitalsIfEnabled(side, settings, now);
    const wakeTimeMs = cfg.wakeWarmup.enabled ? getWakeTime(side, settings, schedulesDB.data, now) : null;

    // Everything below runs synchronously so a hook cannot interleave between decide and apply
    const runtime = getRuntime(side);
    const sideStatus = deviceStatus?.[side];
    const input: DecideInput = {
      now,
      // Live settings, not the copy from before the awaits: a disable that landed meanwhile
      // yields OFF here, and the restore queued behind this tick then removes the offset
      cfg: settingsDB.data[side].autopilot,
      awayAny: settings.left.awayMode || settings.right.awayMode,
      device: deviceStatus && sideStatus ? {
        isOn: sideStatus.isOn,
        isPriming: deviceStatus.isPriming,
        targetF: sideStatus.targetTemperatureF,
        secondsRemaining: sideStatus.secondsRemaining,
      } : null,
      alarmVibrating: memoryDB.data[side].isAlarmVibrating || Boolean(sideStatus?.isAlarmVibrating),
      rt: { ...runtime },
      env: environment ? {
        ambientC: environment.sample.ambientC ?? null,
        humidity: environment.sample.humidity ?? null,
        ageS: environment.ageS,
        ambientValid: environment.sample.ambientValid,
      } : null,
      thermPowerMin15: thermRange.min,
      thermPowerMax15: thermRange.max,
      wakeTimeMs,
      vitals,
      timeZone,
      localDateKey: moment.tz(now, timeZone).format('YYYY-MM-DD'),
      restored: deviceStatus ? takeRestoredSnapshot(side) : null,
    };
    const output = decide(input);
    const previousOffset = runtime.appliedOffset;
    applyRuntimePatch(side, output.rtPatch);

    let wrote = false;
    let sentence = output.sentence;
    if (output.newF !== null) {
      try {
        await updateDeviceStatus({ [side]: { targetTemperatureF: output.newF } });
        noteSetpoint(side, output.newF, 'autopilot');
        applyRuntimePatch(side, { writesTonight: getRuntime(side).writesTonight + 1 });
        wrote = true;
      } catch (error) {
        // Undo the offset so the runtime matches what the device actually has
        applyRuntimePatch(side, { appliedOffset: previousOffset, failCount: getRuntime(side).failCount + 1 });
        sentence = `${output.sentence} (write failed: ${errorMessage(error)})`;
        logger.error(`[autopilot] ${side} write failed: ${errorMessage(error)}`);
      }
    }
    if (wrote || Object.keys(output.rtPatch).length > 0) await persistState();

    const decision = buildDecision(side, now, getRuntime(side), {
      kind: 'tick',
      state: output.state,
      newF: output.newF,
      wrote,
      desiredOffset: output.desiredOffset,
      step: output.step,
      rules: output.rules,
      degraded: output.degraded,
      skippedBecause: output.skippedBecause,
      sentence,
    });
    recordDecision(side, decision);

    const logLine = `[autopilot] ${side}: ${sentence}`;
    if (wrote || output.state === 'SHADOW' && output.skippedBecause === null) logger.info(logLine);
    else logger.debug(logLine);

    serverStatus.status.autopilot.status = 'healthy';
    serverStatus.status.autopilot.message = '';
    serverStatus.status.autopilot.timestamp = moment.tz(now, timeZone).format();
  } catch (error) {
    const message = errorMessage(error);
    serverStatus.status.autopilot.status = 'failed';
    serverStatus.status.autopilot.message = message;
    logger.error(`[autopilot] ${side} tick failed: ${message}`);
    try {
      applyRuntimePatch(side, { failCount: getRuntime(side).failCount + 1 });
    } catch {
      // Never rethrow from a tick
    }
  }
}

/**
 * One autopilot tick for a side: re-read settings, gather device/environment/vitals inputs,
 * decide, apply the runtime patch, write at most one temperature, and log the decision.
 */
export function tick(side: Side) {
  return runExclusive(side, () => runTick(side));
}

export function restoreOnDisable(side: Side) {
  return restoreAnchor(side, { turnOff: true, reason: 'autopilot disabled' });
}

// Best-effort restore of both sides during graceful shutdown
export async function restoreAnchors() {
  await Promise.all(SIDES.map((side) => restoreAnchor(side, { turnOff: false, reason: 'server shutting down' })));
}

export function scheduleAutopilot(settingsData: Settings, side: Side) {
  const cfg = settingsData[side].autopilot;
  if (!cfg?.enabled || settingsData.timeZone === null) {
    const otherSide: Side = side === 'left' ? 'right' : 'left';
    if (!settingsData[otherSide].autopilot?.enabled) {
      serverStatus.status.autopilot.status = 'not_started';
      serverStatus.status.autopilot.message = 'Autopilot is disabled';
    }
    void restoreOnDisable(side);
    return;
  }
  // A real offset left over from active mode is undone when switching to shadow
  const runtime = getRuntime(side);
  if (cfg.mode === 'shadow' && runtime.appliedOffset !== 0 && !runtime.offsetIsVirtual) {
    void restoreAnchor(side, { turnOff: false, reason: 'switched to shadow mode' });
  }

  const rule = side === 'left' ? '*/5 * * * *' : '2-59/5 * * * *';
  logger.debug(`Scheduling autopilot job for ${side} side (${rule})`);
  schedule.scheduleJob(`${side}-autopilot`, { rule, tz: settingsData.timeZone }, () => {
    void tick(side);
  });
}
