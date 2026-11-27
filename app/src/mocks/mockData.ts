import moment from 'moment-timezone';
import type { Services } from '@api/services.ts';
import type { Schedules } from '@api/schedulesSchema.ts';
import type { AutopilotSettings, Settings } from '@api/settingsSchema.ts';
import type { AutopilotSideStatus, AutopilotStatus, Decision } from '@api/autopilot.ts';
import type { DeviceStatus } from '@api/deviceStatusSchema';
import type { MovementRecord } from '@api/movement.ts';
import type { SleepRecord } from '@api/sleepSchema.ts';
import type { VitalsRecord } from '@api/vitals.ts';
import type { ServerStatus } from '@api/serverStatusSchema.ts';
import type { Jobs } from '@api/jobs.ts';

type Side = 'left' | 'right';

type LogStore = Record<string, string[]>;

type QueryFilters = {
  startTime?: string;
  endTime?: string;
  side?: Side;
};

const now = new Date();
const HOURS_TO_MS = 60 * 60 * 1000;
const MINUTES_TO_MS = 60 * 1000;

const clone = <T>(value: T): T => {
  const structured = (globalThis as typeof globalThis & {
    structuredClone?: <U>(source: U) => U;
  }).structuredClone;
  if (typeof structured === 'function') {
    return structured(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const toIso = (date: Date) => date.toISOString();

const createSleepRecord = (id: number, side: Side, nightsAgo: number, durationHours: number, exits: number): SleepRecord => {
  const start = new Date(now.getTime() - nightsAgo * 24 * HOURS_TO_MS + (side === 'left' ? -30 * MINUTES_TO_MS : 0));
  const end = new Date(start.getTime() + durationHours * HOURS_TO_MS);
  const presentInterval: [string, string] = [toIso(start), toIso(end)];
  const absenceStart = new Date(start.getTime() + (durationHours / 2) * HOURS_TO_MS);
  const absenceEnd = new Date(absenceStart.getTime() + 10 * MINUTES_TO_MS);
  const notPresentInterval: [string, string] = [toIso(absenceStart), toIso(absenceEnd)];

  return {
    id,
    side,
    entered_bed_at: presentInterval[0],
    left_bed_at: presentInterval[1],
    sleep_period_seconds: Math.round(durationHours * 60 * 60),
    times_exited_bed: exits,
    present_intervals: [presentInterval],
    not_present_intervals: exits > 0 ? [notPresentInterval] : [],
  };
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 8 hourly samples over 8 hours:
 * 50  → 300 → 1400 → 50 (piecewise-linear)
 */
const createMovementRecords = (): MovementRecord[] => {
  const H = 8; // 8 total records, hourly
  const start = moment.tz(moment.tz.guess()).startOf('hour').subtract(H - 1, 'hours');

  const keyframes = [
    { f: 0.0, v: 50 },
    { f: 0.25, v: 300 },
    { f: 0.5, v: 1400 },
    { f: 1.0, v: 50 },
  ];

  const interp = (f: number) => {
    // find segment [k, k+1] where f lies
    for (let i = 0; i < keyframes.length - 1; i++) {
      const a = keyframes[i], b = keyframes[i + 1];
      if (f <= b.f) {
        const t = (f - a.f) / (b.f - a.f);
        return lerp(a.v, b.v, t);
      }
    }
    return keyframes[keyframes.length - 1].v;
  };

  const records: MovementRecord[] = [];
  for (let i = 0; i < H; i++) {
    const frac = i / (H - 1); // 0 → 1 across 8 points
    const ts = start.clone().add(i, 'hours').format(); // "YYYY-MM-DDTHH:mm:ssZ"
    const value = Math.round(clamp(interp(frac), 1, 1400));
    const side: Side = i % 2 === 0 ? 'left' : 'right';

    records.push({
      id: i + 1,
      side,
      // @ts-expect-error
      timestamp: ts, // e.g. "2025-11-06T23:50:00-08:00"
      total_movement: value, // 1 → 1400 following the 50→300→1400→50 curve
    });
  }
  return records;
};

const createVitalsRecords = (): VitalsRecord[] => {
  const records: VitalsRecord[] = [];
  const sampleHours = 12;
  const intervalMinutes = 15;
  for (let index = 0; index <= (sampleHours * 60) / intervalMinutes; index += 1) {
    const timestamp = Math.floor((now.getTime() - index * intervalMinutes * MINUTES_TO_MS) / 1000);
    const side: Side = index % 2 === 0 ? 'left' : 'right';
    const heartRate = 55 + ((index * 7) % 10);
    const hrv = 80 + ((index * 5) % 20);
    const breathingRate = 10 + ((index * 3) % 5);
    records.push({ side, timestamp, heart_rate: heartRate, hrv, breathing_rate: breathingRate });
  }
  return records;
};

const createSchedules = (): Schedules => ({
  left: {
    sunday: {
      temperatures: { '06:00': 82, '07:00': 100 },
      power: { on: '21:30', off: '07:30', enabled: true, onTemperature: 60 },
      alarm: { time: '07:30', vibrationIntensity: 2, vibrationPattern: 'rise', duration: 10, enabled: true, alarmTemperature: 82 },
    },
    monday: {
      temperatures: { '06:00': 82, '07:00': 100 },
      power: { on: '21:30', off: '07:00', enabled: true, onTemperature: 60 },
      alarm: { time: '07:00', vibrationIntensity: 3, vibrationPattern: 'double', duration: 10, enabled: true, alarmTemperature: 83 },
    },
    tuesday: {
      temperatures: { '06:00': 82, '07:00': 100 },
      power: { on: '21:30', off: '07:00', enabled: true, onTemperature: 60 },
      alarm: { time: '07:00', vibrationIntensity: 2, vibrationPattern: 'rise', duration: 8, enabled: true, alarmTemperature: 82 },
    },
    wednesday: {
      temperatures: { '06:00': 82, '07:00': 100 },
      power: { on: '21:30', off: '07:00', enabled: true, onTemperature: 60 },
      alarm: { time: '07:00', vibrationIntensity: 1, vibrationPattern: 'rise', duration: 8, enabled: true, alarmTemperature: 82 },
    },
    thursday: {
      temperatures: { '06:00': 82, '07:00': 100 },
      power: { on: '21:30', off: '07:00', enabled: true, onTemperature: 60 },
      alarm: { time: '07:00', vibrationIntensity: 2, vibrationPattern: 'rise', duration: 8, enabled: true, alarmTemperature: 81 },
    },
    friday: {
      temperatures: { '06:00': 82, '07:00': 100 },
      power: { on: '22:00', off: '08:00', enabled: true, onTemperature: 60 },
      alarm: { time: '08:00', vibrationIntensity: 3, vibrationPattern: 'rise', duration: 12, enabled: true, alarmTemperature: 84 },
    },
    saturday: {
      temperatures: { '06:00': 82, '07:00': 100 },
      power: { on: '22:30', off: '09:00', enabled: true, onTemperature: 60 },
      alarm: { time: '09:00', vibrationIntensity: 1, vibrationPattern: 'rise', duration: 12, enabled: true, alarmTemperature: 85 },
    },
  },
  right: {
    sunday: {
      temperatures: { '06:00': 82, '07:00': 100 },
      power: { on: '21:00', off: '07:00', enabled: true, onTemperature: 60 },
      alarm: { time: '07:00', vibrationIntensity: 2, vibrationPattern: 'rise', duration: 10, enabled: true, alarmTemperature: 84 },
    },
    monday: {
      temperatures: { '06:00': 82, '07:00': 100 },
      power: { on: '21:00', off: '08:30', enabled: true, onTemperature: 60 },
      alarm: { time: '06:30', vibrationIntensity: 3, vibrationPattern: 'double', duration: 10, enabled: true, alarmTemperature: 84 },
    },
    tuesday: {
      temperatures: { '06:00': 82, '07:00': 100 },
      power: { on: '21:15', off: '06:30', enabled: true, onTemperature: 60 },
      alarm: { time: '06:30', vibrationIntensity: 3, vibrationPattern: 'double', duration: 8, enabled: true, alarmTemperature: 83 },
    },
    wednesday: {
      temperatures: { '05:00': 82, '6:00': 100 },
      power: { on: '21:15', off: '06:30', enabled: true, onTemperature: 60 },
      alarm: { time: '06:30', vibrationIntensity: 2, vibrationPattern: 'double', duration: 8, enabled: true, alarmTemperature: 83 },
    },
    thursday: {
      temperatures: { '05:00': 82, '6:00': 100 },
      power: { on: '21:15', off: '06:30', enabled: true, onTemperature: 60 },
      alarm: { time: '06:30', vibrationIntensity: 2, vibrationPattern: 'double', duration: 8, enabled: true, alarmTemperature: 83 },
    },
    friday: {
      temperatures: { '05:00': 82, '6:00': 100 },
      power: { on: '22:00', off: '07:30', enabled: true, onTemperature: 60 },
      alarm: { time: '07:30', vibrationIntensity: 3, vibrationPattern: 'rise', duration: 12, enabled: true, alarmTemperature: 85 },
    },
    saturday: {
      temperatures: { '05:00': 82, '6:00': 100 },
      power: { on: '22:30', off: '08:30', enabled: true, onTemperature: 60 },
      alarm: { time: '08:30', vibrationIntensity: 2, vibrationPattern: 'rise', duration: 12, enabled: true, alarmTemperature: 86 },
    },
  },
});

// Server defaults (server/src/db/settings.ts), optionally enabled for the demo
const createAutopilotSettings = (enabled: boolean): AutopilotSettings => ({
  enabled,
  mode: 'active',
  maxOffsetF: 3,
  stepF: 1,
  minMinutesBetweenChanges: 20,
  manualHoldMinutes: 180,
  absoluteMinF: 55,
  absoluteMaxF: 110,
  room: { enabled: true, referenceC: null, gainFPerC: 1.0, deadbandC: 0.5 },
  wakeWarmup: { enabled: false, minutes: 30, deltaF: 2 },
  vitals: { enabled: false, hrDropBpm: 6, deltaF: -1 },
});

const createSettings = (): Settings => ({
  id: 'demo-user',
  timeZone: 'America/Los_Angeles',
  temperatureFormat: 'fahrenheit',
  rebootDaily: true,
  left: {
    name: 'Left side',
    awayMode: false,
    scheduleOverrides: {
      temperatureSchedules: { disabled: false, expiresAt: '' },
      alarm: { disabled: false, timeOverride: '', expiresAt: '' },
    },
    taps: {
      doubleTap: {
        type: 'temperature',
        change: 'decrement',
        amount: 1,
      },
      tripleTap: {
        type: 'temperature',
        change: 'increment',
        amount: 1,
      },
      quadTap: {
        type: 'alarm',
        behavior: 'dismiss',
        snoozeDuration: 60,
        inactiveAlarmBehavior: 'power',
      },
    },
    autopilot: createAutopilotSettings(true),
  },
  right: {
    name: 'Right side',
    awayMode: false,
    scheduleOverrides: {
      temperatureSchedules: { disabled: false, expiresAt: '' },
      alarm: { disabled: false, timeOverride: '', expiresAt: '' },
    },
    taps: {
      doubleTap: {
        type: 'temperature',
        change: 'decrement',
        amount: 1,
      },
      tripleTap: {
        type: 'temperature',
        change: 'increment',
        amount: 1,
      },
      quadTap: {
        type: 'alarm',
        behavior: 'dismiss',
        snoozeDuration: 60,
        inactiveAlarmBehavior: 'power',
      },
    },
    autopilot: createAutopilotSettings(false),
  },
  primePodDaily: { enabled: true, time: '14:30' },
});

const createServices = (): Services => ({
  sentryLogging: {
    enabled: true,
  },
  biometrics: {
    enabled: true,
    jobs: {
      installation: {
        name: 'Biometrics installation',
        description: 'Initial biometric sensor installation',
        status: 'healthy',
        message: 'Installation completed successfully',
        timestamp: now.toISOString(),
      },
      stream: {
        name: 'Biometrics stream',
        description: 'Sensor data ingestion service',
        status: 'healthy',
        message: 'Streaming data smoothly',
        timestamp: new Date(now.getTime() - 2 * MINUTES_TO_MS).toISOString(),
      },
      analyzeSleepLeft: {
        name: 'Analyze sleep - left',
        description: 'Analyzes sleep data for left side',
        status: 'healthy',
        message: 'Last run completed 15 minutes ago',
        timestamp: new Date(now.getTime() - 15 * MINUTES_TO_MS).toISOString(),
      },
      analyzeSleepRight: {
        name: 'Analyze sleep - right',
        description: 'Analyzes sleep data for right side',
        status: 'healthy',
        message: 'Next run scheduled soon',
        timestamp: new Date(now.getTime() - 12 * MINUTES_TO_MS).toISOString(),
      },
      calibrateLeft: {
        name: 'Calibration job - Left',
        description: 'Sensor calibration for left side',
        status: 'healthy',
        message: 'Calibrated this morning',
        timestamp: new Date(now.getTime() - 3 * HOURS_TO_MS).toISOString(),
      },
      calibrateRight: {
        name: 'Calibration job - Right',
        description: 'Sensor calibration for right side',
        status: 'healthy',
        message: 'Calibrated this morning',
        timestamp: new Date(now.getTime() - 3 * HOURS_TO_MS).toISOString(),
      },
    },
  },
});

const createDeviceStatus = (): DeviceStatus => ({
  left: {
    currentTemperatureLevel: 4,
    currentTemperatureF: 82,
    targetTemperatureF: 84,
    secondsRemaining: 1_200,
    isOn: true,
    isAlarmVibrating: false,
  },
  right: {
    currentTemperatureLevel: 5,
    currentTemperatureF: 85,
    targetTemperatureF: 86,
    secondsRemaining: 1_560,
    isOn: true,
    isAlarmVibrating: false,
  },
  waterLevel: 'true',
  isPriming: true,
  settings: {
    v: 12,
    gainLeft: 3,
    gainRight: 4,
    ledBrightness: 60,
  },
  coverVersion: 'Pod 5',
  hubVersion: 'Pod 5',
  freeSleep: {
    version: '1.2.0',
    branch: 'main',
  },
  wifiStrength: 82,
});

const createDecision = (minutesAgo: number, partial: Partial<Decision> & Pick<Decision, 'sentence'>): Decision => ({
  at: now.getTime() - minutesAgo * MINUTES_TO_MS,
  side: 'left',
  kind: 'tick',
  state: 'ACTIVE',
  anchorF: 85,
  appliedOffset: 0,
  newF: null,
  wrote: false,
  desiredOffset: 0,
  step: 0,
  rules: { room: 0, wake: 0, sleep: 0 },
  degraded: [],
  skippedBecause: null,
  ...partial,
});

const createAutopilotSideStatus = (side: Side): AutopilotSideStatus => {
  const isLeft = side === 'left';
  return {
    enabled: isLeft,
    mode: 'active',
    state: isLeft ? 'ACTIVE' : 'OFF',
    anchorF: isLeft ? 85 : null,
    anchorSource: isLeft ? 'schedule' : null,
    appliedOffset: isLeft ? -1 : 0,
    offsetIsVirtual: false,
    lastWrittenF: isLeft ? 84 : null,
    lastWriteAt: isLeft ? now.getTime() - 25 * MINUTES_TO_MS : null,
    holdUntil: null,
    pausedUntil: null,
    failCount: 0,
    writesTonight: isLeft ? 1 : 0,
    inputs: {
      ambientC: 22.6,
      humidity: 48.2,
      envAgeS: 14,
      refC: isLeft ? 21.5 : null,
      bedCenC: 29.4,
      bedInC: 29.9,
      thermPower: -0.42,
      thermTargetC: 28.9,
    },
    decisions: isLeft ? [
      createDecision(55, { state: 'SETTLING', skippedBecause: 'settling', sentence: 'Settling after schedule change to 85°F' }),
      createDecision(25, {
        appliedOffset: -1, newF: 84, wrote: true, desiredOffset: -1, step: -1, rules: { room: -1, wake: 0, sleep: 0 },
        sentence: 'Room 22.6 C (+1.1 vs 21.5 ref) → −1 F; wake 0; wrote 84 F (anchor 85, offset −1)',
      }),
      createDecision(5, {
        appliedOffset: -1, desiredOffset: -1, rules: { room: -1, wake: 0, sleep: 0 }, skippedBecause: 'at target',
        sentence: 'Room 22.6 C (+1.1 vs 21.5 ref) → −1 F; wake 0; holding 84 F (anchor 85, offset −1)',
      }),
    ] : [],
  };
};

const createServerStatus = (): ServerStatus => ({
  alarmSchedule: {
    name: 'Alarm schedule',
    status: 'healthy',
    description: 'Alarm scheduling service',
    message: 'Next alarm ready',
  },
  autopilot: {
    name: 'Autopilot',
    status: 'healthy',
    description: 'Nudges bed temperature around your setpoint based on room conditions',
    message: '',
  },
  environment: {
    name: 'Environment sensors',
    status: 'healthy',
    description: 'Room temperature and humidity samples used by autopilot',
    message: '',
  },
  database: {
    name: 'Database',
    status: 'healthy',
    description: 'SQLite database connection',
    message: '',
  },
  express: {
    name: 'Express',
    status: 'healthy',
    description: 'HTTP server',
    message: 'Running in demo mode',
  },
  franken: {
    name: 'Franken sock',
    status: 'healthy',
    description: 'Hardware socket interface',
    message: '',
  },
  frankenMonitor: {
    name: 'Franken monitor',
    status: 'not_started',
    description: 'Handles gestures and monitoring the status',
    message: '',
  },
  jobs: {
    name: 'Job scheduler',
    status: 'healthy',
    description: 'Background job execution',
    message: 'All jobs executed successfully overnight',
  },
  logger: {
    name: 'Logger',
    status: 'healthy',
    description: 'Application logs',
    message: '',
  },
  powerSchedule: {
    name: 'Power schedule',
    status: 'healthy',
    description: 'Controls power on/off cycles',
    message: 'Bed powered on for bedtime routine',
  },
  primeSchedule: {
    name: 'Prime schedule',
    status: 'healthy',
    description: 'Daily prime job',
    message: 'Next prime scheduled for 14:30',
  },
  rebootSchedule: {
    name: 'Reboot schedule',
    status: 'healthy',
    description: 'Daily system reboot',
    message: 'Reboot completed successfully last night',
  },
  systemDate: {
    name: 'System date',
    status: 'healthy',
    description: 'System clock status',
    message: '',
  },
  temperatureSchedule: {
    name: 'Temperature schedule',
    status: 'healthy',
    description: 'Temperature automation',
    message: '',
  },
  analyzeSleepLeft: {
    name: 'Analyze sleep - left',
    status: 'healthy',
    description: 'Sleep analytics for left side',
    message: 'Last analysis completed successfully',
  },
  analyzeSleepRight: {
    name: 'Analyze sleep - right',
    status: 'healthy',
    description: 'Sleep analytics for right side',
    message: 'Last analysis completed successfully',
  },
  biometricsInstallation: {
    name: 'Biometrics installation',
    status: 'healthy',
    description: 'Installation status',
    message: '',
  },
  biometricsStream: {
    name: 'Biometrics stream',
    status: 'healthy',
    description: 'Biometrics data stream',
    message: '',
    timestamp: new Date(now.getTime() - 2 * MINUTES_TO_MS).toISOString(),
  },
  biometricsCalibrationLeft: {
    name: 'Calibration job - Left',
    status: 'healthy',
    description: 'Left side calibration',
    message: '',
  },
  biometricsCalibrationRight: {
    name: 'Calibration job - Right',
    status: 'healthy',
    description: 'Right side calibration',
    message: '',
  },
});

const createLogs = (): LogStore => ({
  'free-sleep.log': [
    `[${new Date(now.getTime() - 3 * MINUTES_TO_MS).toISOString()}] INFO Starting Free Sleep demo mode`,
    `[${new Date(now.getTime() - 2 * MINUTES_TO_MS).toISOString()}] INFO Schedules loaded successfully`,
    `[${new Date(now.getTime() - 90 * 1000).toISOString()}] INFO Biometrics stream connected`,
    `[${new Date(now.getTime() - 30 * 1000).toISOString()}] INFO Demo data refreshed`,
  ],
  'scheduler.log': [
    `[${new Date(now.getTime() - 6 * MINUTES_TO_MS).toISOString()}] INFO Prime job executed`,
    `[${new Date(now.getTime() - 4 * MINUTES_TO_MS).toISOString()}] INFO Temperature schedule updated`,
    `[${new Date(now.getTime() - 60 * 1000).toISOString()}] INFO Nightly reboot completed`,
  ],
});

let sleepRecords = [
  createSleepRecord(5, 'left', 3, 7.1, 0),
  createSleepRecord(6, 'right', 3, 7.0, 0),


  createSleepRecord(3, 'left', 2, 7.8, 1),
  createSleepRecord(4, 'right', 2, 7.4, 2),

  createSleepRecord(1, 'left', 1, 7.5, 1),
  createSleepRecord(2, 'right', 1, 7.2, 0),
];

const movementRecords = createMovementRecords();
const vitalsRecords = createVitalsRecords();
let schedules = createSchedules();
let settings = createSettings();
let services = createServices();
let deviceStatus = createDeviceStatus();
let serverStatus = createServerStatus();
const autopilotStatus: AutopilotStatus = { left: createAutopilotSideStatus('left'), right: createAutopilotSideStatus('right') };
let logsStore = createLogs();

export const mergeDeep = (target: unknown, source: unknown): unknown => {
  if (source === undefined || source === null) {
    return target;
  }
  if (Array.isArray(source)) {
    return Array.isArray(target) ? source.slice() : source.slice();
  }
  if (typeof source === 'object') {
    const targetObj = typeof target === 'object' && target !== null ? target as Record<string, unknown> : {};
    const sourceObj = source as Record<string, unknown>;
    const result: Record<string, unknown> = { ...targetObj };
    Object.entries(sourceObj).forEach(([key, value]) => {
      result[key] = mergeDeep(result[key], value);
    });
    return result;
  }
  return source;
};

export const getServices = () => services;
export const updateServices = (partial: Partial<Services>) => {
  services = mergeDeep(clone(services), partial) as Services;
  return services;
};

export const getSchedules = () => schedules;
export const updateSchedules = (partial: Partial<Schedules>) => {
  schedules = mergeDeep(clone(schedules), partial) as Schedules;
  return schedules;
};

export const getSettings = () => settings;
export const updateSettings = (partial: Partial<Settings>) => {
  const partialCopy = { ...partial };
  // Never allow overwriting the generated ID in demo mode
  delete (partialCopy as { id?: string }).id;
  settings = mergeDeep(clone(settings), partialCopy) as Settings;
  return settings;
};

export const getDeviceStatus = () => deviceStatus;
export const updateDeviceStatus = (partial: Partial<DeviceStatus>) => {
  deviceStatus = mergeDeep(clone(deviceStatus), partial) as DeviceStatus;
  return deviceStatus;
};

export const getServerStatus = () => serverStatus;
export const setServerStatus = (next: ServerStatus) => {
  serverStatus = clone(next);
  return serverStatus;
};

// Runtime comes from the mock store; enabled / mode always follow the current mock settings
export const getAutopilotStatus = (): AutopilotStatus => {
  const withSettings = (side: Side): AutopilotSideStatus => {
    const config = settings[side].autopilot;
    const runtime = autopilotStatus[side];
    if (!config.enabled) return { ...runtime, enabled: false, mode: config.mode, state: 'OFF' };
    const isPaused = runtime.pausedUntil !== null && runtime.pausedUntil > Date.now();
    const runningState = config.mode === 'shadow' ? 'SHADOW' : 'ACTIVE';
    return { ...runtime, enabled: true, mode: config.mode, state: isPaused ? 'PAUSED' : runningState };
  };
  return { left: withSettings('left'), right: withSettings('right') };
};

export const pauseAutopilot = (side: Side, minutes: number) => {
  autopilotStatus[side] = { ...autopilotStatus[side], pausedUntil: Date.now() + minutes * MINUTES_TO_MS };
  return getAutopilotStatus()[side];
};

export const resumeAutopilot = (side: Side) => {
  autopilotStatus[side] = { ...autopilotStatus[side], pausedUntil: null };
  return getAutopilotStatus()[side];
};

export const listSleepRecords = () => sleepRecords;
export const setSleepRecords = (records: SleepRecord[]) => {
  sleepRecords = records;
  return sleepRecords;
};

export const listMovementRecords = () => movementRecords;


export const listVitalsRecords = () => vitalsRecords;


export const listLogs = () => logsStore;
export const setLogs = (next: LogStore) => {
  logsStore = next;
  return logsStore;
};

export const getLogFiles = () => Object.keys(logsStore);

export const appendLogEntry = (file: string, message: string) => {
  if (!logsStore[file]) {
    logsStore[file] = [];
  }
  logsStore[file].push(message);
  if (logsStore[file].length > 1000) {
    logsStore[file] = logsStore[file].slice(-1000);
  }
};

export const filterByQuery = <T extends { side?: Side }>(records: T[], filters: QueryFilters, getTimestamp: (record: T) => number) => {
  const start = filters.startTime ? Date.parse(filters.startTime) : undefined;
  const end = filters.endTime ? Date.parse(filters.endTime) : undefined;
  const side = filters.side;

  return records.filter((record) => {
    if (side && record.side !== side) {
      return false;
    }
    const timestamp = getTimestamp(record);
    if (Number.isFinite(start) && start !== undefined && timestamp < start) {
      return false;
    }
    if (Number.isFinite(end) && end !== undefined && timestamp > end) {
      return false;
    }
    return true;
  });
};

export const handleJobs = (jobs: Jobs) => {
  const timestamp = new Date().toISOString();
  jobs.forEach((job) => {
    appendLogEntry('free-sleep.log', `[${timestamp}] INFO Job executed: ${job}`);
  });
};

