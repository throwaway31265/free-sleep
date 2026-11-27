import { Decision } from '@api/autopilot.ts';
import { formatTemperature, formatTemperatureDelta } from '@lib/temperatureConversions.ts';

// Reasons decide() reports once the rules have run; only these get the rule summary prefix
const RULE_STAGE_REASONS = new Set(['at desired offset', 'nightly write limit', 'min gap', 'at limit']);

// Rule contributions in the user's unit, e.g. "Room −1°F · wake +2°F"
function describeRules(decision: Decision, celsius: boolean): string {
  const parts: string[] = [];
  if (decision.degraded.includes('room')) parts.push('Room data unavailable');
  else if (decision.rules.room !== 0) parts.push(`Room ${formatTemperatureDelta(decision.rules.room, celsius)}`);
  if (decision.rules.wake !== 0) parts.push(`wake ${formatTemperatureDelta(decision.rules.wake, celsius)}`);
  if (decision.degraded.includes('vitals')) parts.push('sleep data unavailable');
  else if (decision.rules.sleep !== 0) parts.push(`sleep ${formatTemperatureDelta(decision.rules.sleep, celsius)}`);
  return parts.join(' · ');
}

// What the decision did, built only from its structured fields
function describeOutcome(decision: Decision, celsius: boolean): string {
  const anchor = decision.anchorF !== null ? formatTemperature(decision.anchorF, celsius) : null;
  const offset = formatTemperatureDelta(decision.appliedOffset, celsius);
  const fromAnchor = anchor ? ` (${offset} from ${anchor})` : '';
  switch (decision.skippedBecause) {
  case null: {
    if (decision.state === 'SHADOW' && decision.anchorF !== null) {
      return `Would set ${formatTemperature(decision.anchorF + decision.appliedOffset, celsius)}${fromAnchor}`;
    }
    const target = decision.newF !== null ? formatTemperature(decision.newF, celsius) : 'a new temperature';
    return decision.wrote ? `Set ${target}${fromAnchor}` : `Tried to set ${target}; the write failed`;
  }
  case 'at desired offset':
    return decision.appliedOffset === 0 ? 'No change needed' : `No change; holding ${offset}`;
  case 'min gap':
    return `Waiting before the next change (aiming for ${formatTemperatureDelta(decision.desiredOffset, celsius)})`;
  case 'nightly write limit':
    return 'Nightly change limit reached';
  case 'at limit':
    return 'Already at your absolute temperature limit';
  case 'new anchor':
    return anchor ? `New setpoint ${anchor}; waiting before adjusting` : 'New setpoint; waiting before adjusting';
  case 'external change':
    return anchor ? `Changed to ${anchor} outside the app; holding` : 'Changed outside the app; holding';
  case 'settling':
    return anchor ? `Schedule set ${anchor}; letting it settle` : 'Letting the schedule change settle';
  case 'hold':
    return 'Holding after a change';
  case 'paused':
    return 'Paused';
  case 'disabled':
    return 'Autopilot is off';
  case 'away':
    return 'Away mode is on; idle';
  case 'device read failed':
    return 'Could not read the pod; no change';
  default:
    return `Idle: ${decision.skippedBecause}`;
  }
}

/**
 * One-line, unit-aware description of an autopilot decision. The server's own sentence uses
 * fixed F / C units for the logs, so the app rebuilds the text in the user's format.
 */
export function describeDecision(decision: Decision, celsius: boolean): string {
  if (decision.kind === 'restore') {
    return decision.anchorF !== null ? `Restored ${formatTemperature(decision.anchorF, celsius)}` : 'Restored the setpoint';
  }
  if (decision.kind === 'correction') {
    const source = decision.correction?.source === 'tap' ? 'Tap' : 'Manual';
    const target = decision.correction?.newTargetF ?? decision.anchorF;
    return target !== null && target !== undefined
      ? `${source} change to ${formatTemperature(target, celsius)}; autopilot holding`
      : `${source} change; autopilot holding`;
  }
  const outcome = describeOutcome(decision, celsius);
  const showsRules = decision.skippedBecause === null || RULE_STAGE_REASONS.has(decision.skippedBecause);
  const rules = showsRules ? describeRules(decision, celsius) : '';
  return rules ? `${rules} → ${outcome}` : outcome;
}
