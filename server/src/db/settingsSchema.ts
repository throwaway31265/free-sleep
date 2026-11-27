import { z } from 'zod';
import { TIME_ZONES } from './timeZones.js';
import { TimeSchema } from './schedulesSchema.js';

export const TEMPERATURES = ['celsius', 'fahrenheit'] as const;
const Temperatures = z.enum(TEMPERATURES);


const TemperatureTapConfig = z.object({
  type: z.literal('temperature'),
  change: z.enum(['increment', 'decrement']),
  amount: z.number().min(0).max(10),
});

const AlarmTapConfig = z.object({
  type: z.literal('alarm'),
  behavior: z.enum(['snooze', 'dismiss']),
  snoozeDuration: z.number().min(60).max(600),
  inactiveAlarmBehavior: z.enum(['power', 'none'])
});

export const TapConfig = z.discriminatedUnion('type', [
  TemperatureTapConfig,
  AlarmTapConfig,
]);

export const GestureSchema = z.enum(['doubleTap', 'tripleTap', 'quadTap']);

// Hard safety limits for autopilot, enforced at runtime even if settings are edited by hand
export const AUTOPILOT_HARD_MAX_OFFSET_F = 5;
export const AUTOPILOT_HARD_MAX_STEP_F = 2;
export const AUTOPILOT_HARD_MIN_GAP_MIN = 10;
export const AUTOPILOT_MAX_WRITES_PER_NIGHT = 24;

// No .refine() here: SettingsSchema.deepPartial() is used by POST /api/settings.
// absoluteMinF <= absoluteMaxF is enforced at runtime instead.
export const AutopilotSettingsSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['active', 'shadow']),
  maxOffsetF: z.number().int().min(1).max(AUTOPILOT_HARD_MAX_OFFSET_F),
  stepF: z.number().int().min(1).max(AUTOPILOT_HARD_MAX_STEP_F),
  minMinutesBetweenChanges: z.number().int().min(AUTOPILOT_HARD_MIN_GAP_MIN).max(120),
  manualHoldMinutes: z.number().int().min(30).max(720),
  absoluteMinF: z.number().int().min(55).max(110),
  absoluteMaxF: z.number().int().min(55).max(110),
  room: z.object({
    enabled: z.boolean(),
    // null = capture a reference automatically each night
    referenceC: z.number().min(15).max(30).nullable(),
    gainFPerC: z.number().min(0).max(2),
    deadbandC: z.number().min(0).max(2),
  }).strict(),
  wakeWarmup: z.object({
    enabled: z.boolean(),
    minutes: z.number().int().min(10).max(90),
    deltaF: z.number().int().min(0).max(4),
  }).strict(),
  // Experimental: heart rate / presence are unreliable on Pod 5
  vitals: z.object({
    enabled: z.boolean(),
    hrDropBpm: z.number().int().min(3).max(15),
    deltaF: z.number().int().min(-2).max(0),
  }).strict(),
}).strict();

const SideSettingsSchema = z.object({
  name: z.string().min(1).max(20),
  awayMode: z.boolean(),
  scheduleOverrides: z.object({
    temperatureSchedules: z.object({
      disabled: z.boolean(),
      expiresAt: z.string(),
    }),
    alarm: z.object({
      disabled: z.boolean(),
      timeOverride: z.string(),
      expiresAt: z.string(),
    })
  }),
  taps: z.object({
    doubleTap: TapConfig,
    tripleTap: TapConfig,
    quadTap: TapConfig,
  }),
  autopilot: AutopilotSettingsSchema,
}).strict();

export const SettingsSchema = z.object({
  id: z.string(),
  timeZone: z.enum(TIME_ZONES),
  left: SideSettingsSchema,
  right: SideSettingsSchema,
  primePodDaily: z.object({
    enabled: z.boolean(),
    time: TimeSchema,
  }),
  temperatureFormat: Temperatures,
  rebootDaily: z.boolean(),
}).strict();

export type SideSettings = z.infer<typeof SideSettingsSchema>;
export type AutopilotSettings = z.infer<typeof AutopilotSettingsSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Gesture = z.infer<typeof GestureSchema>
