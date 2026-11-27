// Shared autopilot types. Pure: no I/O imports, so decide.ts and its check script can use them.
import type { Side } from '../db/schedulesSchema.js';

export type AutopilotState = 'OFF' | 'IDLE' | 'SETTLING' | 'ACTIVE' | 'SHADOW' | 'HOLD' | 'PAUSED' | 'FAULT';
export type AnchorSource = 'schedule' | 'manual' | 'tap' | 'unknown';
export type SetpointSource = 'schedule' | 'manual' | 'tap' | 'autopilot';
export type DecisionKind = 'tick' | 'correction' | 'restore';

export type RuleContributions = { room: number; wake: number; sleep: number };

// Context captured when a person corrects the bed (v2 learning data)
export type CorrectionContext = {
  source: 'manual' | 'tap';
  ambientC: number | null;
  humidity: number | null;
  previousTargetF: number | null;
  prevOffset: number;
  newTargetF: number;
};

export type Decision = {
  at: number; // epoch ms
  side: Side;
  kind: DecisionKind;
  state: AutopilotState;
  anchorF: number | null;
  appliedOffset: number;
  newF: number | null; // value written (or that shadow mode would have written)
  wrote: boolean;
  desiredOffset: number;
  step: number;
  rules: RuleContributions;
  degraded: string[];
  skippedBecause: string | null;
  sentence: string;
  correction?: CorrectionContext;
};

export type AutopilotRuntime = {
  state: AutopilotState;
  anchorF: number | null;
  anchorSource: AnchorSource | null;
  anchorAt: number | null; // epoch ms
  nightRefC: number | null; // reference ambient for this night
  nightKey: string | null; // YYYY-MM-DD of power-on
  appliedOffset: number;
  // True when appliedOffset only exists on paper (shadow mode), never written to the device
  offsetIsVirtual: boolean;
  lastWrittenF: number | null;
  lastWriteAt: number | null;
  holdUntil: number | null;
  pausedUntil: number | null;
  failCount: number;
  writesTonight: number;
  lastHookAt: number | null; // last noteSetpoint from any hook
  log: Decision[]; // ring of DECISION_RING_SIZE
};

// Subset of the runtime saved to state.json, used to restore the anchor after a restart
export type PersistedRuntime = Omit<AutopilotRuntime, 'log'>;

export const DECISION_RING_SIZE = 200;

export const createDefaultRuntime = (): AutopilotRuntime => ({
  state: 'OFF',
  anchorF: null,
  anchorSource: null,
  anchorAt: null,
  nightRefC: null,
  nightKey: null,
  appliedOffset: 0,
  offsetIsVirtual: false,
  lastWrittenF: null,
  lastWriteAt: null,
  holdUntil: null,
  pausedUntil: null,
  failCount: 0,
  writesTonight: 0,
  lastHookAt: null,
  log: [],
});
