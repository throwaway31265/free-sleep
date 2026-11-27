// Autopilot runtime state: lives in memoryDB, persisted to ${dbFolder}autopilot/ (never lowdb,
// because chokidar would rebuild every job on each write).
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import moment from 'moment-timezone';

import config from '../config.js';
import logger from '../logger.js';
import memoryDB from '../db/memoryDB.js';
import settingsDB from '../db/settings.js';
import type { Side } from '../db/schedulesSchema.js';
import { getEnvironment } from '../routes/metrics/environment.js';
import { clampFinal, ENV_STALE_S, RESTORE_MAX_AGE_MS, RestoredSnapshot } from './decide.js';
import {
  AutopilotRuntime,
  createDefaultRuntime,
  Decision,
  DECISION_RING_SIZE,
  PersistedRuntime,
  SetpointSource,
} from './types.js';

export const AUTOPILOT_FOLDER = path.join(config.dbFolder, 'autopilot');
const STATE_FILE = path.join(AUTOPILOT_FOLDER, 'state.json');
const DECISIONS_FILE = path.join(AUTOPILOT_FOLDER, 'decisions.jsonl');
const DECISIONS_MAX_BYTES = 1024 * 1024;
const SIDES: Side[] = ['left', 'right'];

type StateFile = {
  savedAt: number;
  left: PersistedRuntime;
  right: PersistedRuntime;
};

const restoredSnapshots: Record<Side, RestoredSnapshot | null> = { left: null, right: null };

// Writes are chained so state.json renames and JSONL appends never interleave
let writeChain: Promise<void> = Promise.resolve();
const enqueueWrite = (task: () => Promise<void>) => {
  writeChain = writeChain.then(task).catch((error) => {
    logger.warn(`[autopilot] failed to write state: ${error instanceof Error ? error.message : String(error)}`);
  });
  return writeChain;
};

export const getRuntime = (side: Side): AutopilotRuntime => memoryDB.data[side].autopilot;

export function applyRuntimePatch(side: Side, patch: Partial<AutopilotRuntime>) {
  Object.assign(memoryDB.data[side].autopilot, patch);
}

function assertFolderOutsideLowDb() {
  const autopilotFolder = path.resolve(AUTOPILOT_FOLDER) + path.sep;
  const lowDbFolder = path.resolve(config.lowDbFolder) + path.sep;
  if (autopilotFolder.startsWith(lowDbFolder)) {
    throw new Error(`Autopilot folder ${autopilotFolder} must not be inside the lowdb folder ${lowDbFolder}`);
  }
}

const toPersisted = (runtime: AutopilotRuntime): PersistedRuntime => {
  const { log, ...rest } = runtime;
  return rest;
};

// Loads state.json at boot. A corrupt file is moved aside; anything older than 12 h is ignored.
function loadStateFile() {
  assertFolderOutsideLowDb();
  try {
    fs.mkdirSync(AUTOPILOT_FOLDER, { recursive: true });
  } catch (error) {
    logger.warn(`[autopilot] cannot create ${AUTOPILOT_FOLDER}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  if (!fs.existsSync(STATE_FILE)) return;

  let parsed: StateFile;
  try {
    parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as StateFile;
    if (typeof parsed?.savedAt !== 'number') throw new Error('missing savedAt');
  } catch (error) {
    const corruptPath = `${STATE_FILE}.corrupt-${Date.now()}`;
    logger.warn(`[autopilot] state.json is corrupt (${error instanceof Error ? error.message : String(error)}), moving to ${corruptPath}`);
    try {
      fs.renameSync(STATE_FILE, corruptPath);
    } catch (renameError) {
      logger.warn(`[autopilot] could not move corrupt state.json: ${String(renameError)}`);
    }
    return;
  }

  if (Date.now() - parsed.savedAt >= RESTORE_MAX_AGE_MS) {
    logger.info('[autopilot] state.json is older than 12 h, starting fresh');
    return;
  }

  SIDES.forEach((side) => {
    const saved = parsed[side];
    if (!saved) return;
    // The anchor itself is only restored by decide() once the device confirms lastWrittenF
    applyRuntimePatch(side, {
      ...createDefaultRuntime(),
      nightRefC: saved.nightRefC ?? null,
      nightKey: saved.nightKey ?? null,
      writesTonight: saved.writesTonight ?? 0,
      lastWrittenF: saved.lastWrittenF ?? null,
      lastWriteAt: saved.lastWriteAt ?? null,
      holdUntil: saved.holdUntil ?? null,
      pausedUntil: saved.pausedUntil ?? null,
      lastHookAt: saved.lastHookAt ?? null,
      log: [],
    });
    if (typeof saved.anchorF === 'number' && !saved.offsetIsVirtual) {
      restoredSnapshots[side] = {
        anchorF: saved.anchorF,
        anchorSource: saved.anchorSource ?? null,
        anchorAt: saved.anchorAt ?? null,
        appliedOffset: saved.appliedOffset ?? 0,
        lastWrittenF: saved.lastWrittenF ?? null,
        savedAt: parsed.savedAt,
      };
    }
  });
  logger.info('[autopilot] restored runtime state from state.json');
}

// Returns the boot snapshot once; later ticks re-anchor normally
export function takeRestoredSnapshot(side: Side): RestoredSnapshot | null {
  const snapshot = restoredSnapshots[side];
  restoredSnapshots[side] = null;
  return snapshot;
}

export function peekRestoredSnapshot(side: Side): RestoredSnapshot | null {
  return restoredSnapshots[side];
}

// Atomic write (tmp + rename) of both sides' runtime, minus the decision log
export function persistState(): Promise<void> {
  const snapshot: StateFile = {
    savedAt: Date.now(),
    left: toPersisted(getRuntime('left')),
    right: toPersisted(getRuntime('right')),
  };
  return enqueueWrite(async () => {
    const tmpPath = `${STATE_FILE}.tmp`;
    await fsPromises.mkdir(AUTOPILOT_FOLDER, { recursive: true });
    await fsPromises.writeFile(tmpPath, JSON.stringify(snapshot));
    await fsPromises.rename(tmpPath, STATE_FILE);
  });
}

async function appendDecisionLine(decision: Decision) {
  try {
    const stats = await fsPromises.stat(DECISIONS_FILE);
    if (stats.size > DECISIONS_MAX_BYTES) {
      await fsPromises.rename(DECISIONS_FILE, `${DECISIONS_FILE}.1`);
    }
  } catch {
    // File does not exist yet
  }
  await fsPromises.appendFile(DECISIONS_FILE, `${JSON.stringify(decision)}\n`);
}

// Adds a decision to the memory ring and the JSONL file. Repeated identical idle ticks are not stored.
export function recordDecision(side: Side, decision: Decision) {
  const runtime = getRuntime(side);
  const previous = runtime.log.at(-1);
  const isRepeat = previous !== undefined && decision.kind === 'tick' && !decision.wrote
    && previous.kind === 'tick' && previous.state === decision.state && previous.sentence === decision.sentence;
  if (isRepeat) return;
  runtime.log.push(decision);
  if (runtime.log.length > DECISION_RING_SIZE) runtime.log.splice(0, runtime.log.length - DECISION_RING_SIZE);
  void enqueueWrite(() => appendDecisionLine(decision));
}

// Reads the newest decisions for a side from the JSONL files (current file first, then .1)
export async function readDecisionFile(side: Side, limit: number): Promise<Decision[]> {
  const collected: Decision[] = [];
  for (const filePath of [DECISIONS_FILE, `${DECISIONS_FILE}.1`]) {
    if (collected.length >= limit) break;
    let content: string;
    try {
      content = await fsPromises.readFile(filePath, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split('\n').filter(Boolean).reverse();
    for (const line of lines) {
      try {
        const decision = JSON.parse(line) as Decision;
        if (decision.side === side) collected.push(decision);
      } catch {
        // Skip a partially written line
      }
      if (collected.length >= limit) break;
    }
  }
  return collected.reverse();
}

// Current ambient reading, only if it is fresh and passed the glitch filter
export function getValidAmbient(): { ambientC: number; humidity: number | null } | null {
  const environment = getEnvironment();
  if (!environment) return null;
  const { sample, ageS } = environment;
  const ambientC = sample.ambientC;
  if (ageS > ENV_STALE_S || !sample.ambientValid || typeof ambientC !== 'number' || ambientC < 5 || ambientC > 40) return null;
  return { ambientC, humidity: sample.humidity ?? null };
}

const formatClock = (epochMs: number) => moment.tz(epochMs, settingsDB.data.timeZone || 'UTC').format('HH:mm');

// Records a person's correction as a decision; this is the learning data for v2
function recordCorrection(side: Side, source: 'manual' | 'tap', newTargetF: number, before: AutopilotRuntime, now: number) {
  const runtime = getRuntime(side);
  const ambient = getValidAmbient();
  const previousTargetF = before.anchorF !== null
    ? clampFinal(settingsDB.data[side].autopilot, before.anchorF, before.anchorF + before.appliedOffset)
    : before.lastWrittenF;
  const holdClock = runtime.holdUntil !== null ? formatClock(runtime.holdUntil) : '';
  recordDecision(side, {
    at: now,
    side,
    kind: 'correction',
    state: runtime.state,
    anchorF: newTargetF,
    appliedOffset: 0,
    newF: null,
    wrote: false,
    desiredOffset: 0,
    step: 0,
    rules: { room: 0, wake: 0, sleep: 0 },
    degraded: [],
    skippedBecause: null,
    sentence: `${source === 'tap' ? 'Tap' : 'Manual'} change to ${newTargetF} F; new anchor, holding until ${holdClock}`,
    correction: {
      source,
      ambientC: ambient?.ambientC ?? null,
      humidity: ambient?.humidity ?? null,
      previousTargetF,
      prevOffset: before.appliedOffset,
      newTargetF,
    },
  });
}

/**
 * Called by every path that sets a temperature. Manual and tap changes become the new anchor
 * and start a hold; schedule changes move the anchor but keep the current offset; autopilot
 * writes only record what was written. Never throws.
 */
export function noteSetpoint(side: Side, temperatureF: number, source: SetpointSource) {
  try {
    const now = Date.now();
    const runtime = getRuntime(side);
    if (source === 'autopilot') {
      applyRuntimePatch(side, { lastWrittenF: temperatureF, lastWriteAt: now });
    } else if (source === 'schedule') {
      applyRuntimePatch(side, { anchorF: temperatureF, anchorSource: 'schedule', anchorAt: now, lastHookAt: now });
    } else {
      const before = { ...runtime };
      const cfg = settingsDB.data[side].autopilot;
      const ambient = getValidAmbient();
      applyRuntimePatch(side, {
        anchorF: temperatureF,
        anchorSource: source,
        anchorAt: now,
        appliedOffset: 0,
        offsetIsVirtual: false,
        holdUntil: now + cfg.manualHoldMinutes * 60 * 1000,
        nightRefC: ambient ? ambient.ambientC : runtime.nightRefC,
        lastHookAt: now,
      });
      if (cfg.enabled) recordCorrection(side, source, temperatureF, before, now);
    }
    void persistState();
  } catch (error) {
    logger.warn(`[autopilot] noteSetpoint failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Value a schedule job should write. Keeps the autopilot offset across a schedule change so the
 * bed does not bounce back to the raw schedule value and then step away again.
 */
export function scheduledTarget(side: Side, temperatureF: number): number {
  noteSetpoint(side, temperatureF, 'schedule');
  try {
    const cfg = settingsDB.data[side].autopilot;
    const runtime = getRuntime(side);
    const now = Date.now();
    const isApplying = cfg.enabled && cfg.mode === 'active'
      && (runtime.state === 'ACTIVE' || runtime.state === 'SETTLING')
      && !runtime.offsetIsVirtual
      && !(runtime.holdUntil !== null && runtime.holdUntil > now)
      && !(runtime.pausedUntil !== null && runtime.pausedUntil > now);
    if (!isApplying || runtime.appliedOffset === 0) {
      // The device gets the raw schedule value, so a real offset is gone. A shadow offset is
      // virtual and keeps simulating across the schedule change.
      const keepsVirtualOffset = cfg.mode === 'shadow' && runtime.offsetIsVirtual;
      if (runtime.appliedOffset !== 0 && !keepsVirtualOffset) {
        applyRuntimePatch(side, { appliedOffset: 0, offsetIsVirtual: false });
        void persistState();
      }
      return temperatureF;
    }
    const target = clampFinal(cfg, temperatureF, temperatureF + runtime.appliedOffset);
    applyRuntimePatch(side, { lastWrittenF: target, appliedOffset: target - temperatureF });
    void persistState();
    return target;
  } catch (error) {
    logger.warn(`[autopilot] scheduledTarget failed, using the schedule value: ${String(error)}`);
    return temperatureF;
  }
}

export function pause(side: Side, minutes: number) {
  applyRuntimePatch(side, { pausedUntil: Date.now() + minutes * 60 * 1000, state: 'PAUSED' });
  void persistState();
}

export function resume(side: Side) {
  const runtime = getRuntime(side);
  applyRuntimePatch(side, { pausedUntil: null, state: runtime.state === 'PAUSED' ? 'IDLE' : runtime.state });
  void persistState();
}

loadStateFile();
