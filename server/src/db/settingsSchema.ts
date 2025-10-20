import { z } from 'zod';
import { TimeSchema } from './schedulesSchema.js';
import { TIME_ZONES } from './timeZones.js';

export const TEMPERATURES = ['celsius', 'fahrenheit'] as const;
const Temperatures = z.enum(TEMPERATURES);
export type TemperatureFormat = z.infer<typeof Temperatures>;

export const ALARM_BUTTON_BEHAVIORS = ['dismiss', 'snooze'] as const;
const AlarmButtonBehaviors = z.enum(ALARM_BUTTON_BEHAVIORS);
export type AlarmButtonBehavior = z.infer<typeof AlarmButtonBehaviors>;

const SideSettingsSchema = z
  .object({
    name: z.string().min(1).max(20),
    awayMode: z.boolean(),
    // Optional ISO datetime when away mode should automatically start
    awayStart: z.string().datetime().nullable().optional(),
    // Optional ISO datetime when away mode should automatically end
    awayReturn: z.string().datetime().nullable().optional(),
  })
  .strict();

export const SettingsSchema = z
  .object({
    timeZone: z.enum(TIME_ZONES).nullable(),
    linkBothSides: z.boolean(),
    left: SideSettingsSchema,
    right: SideSettingsSchema,
    lastPrime: z.string().datetime().optional(),
    primePodDaily: z.object({
      enabled: z.boolean(),
      time: TimeSchema,
    }),
    temperatureFormat: Temperatures,
    rebootDaily: z.boolean(),
    alarmButtonBehavior: AlarmButtonBehaviors,
    ledNightMode: z.object({
      enabled: z.boolean(),
      dayBrightness: z.number().int().min(0).max(100),
      nightBrightness: z.number().int().min(0).max(100),
      nightStartTime: TimeSchema,
      nightEndTime: TimeSchema,
    }).optional().default({
      enabled: false,
      dayBrightness: 50,
      nightBrightness: 10,
      nightStartTime: '22:00',
      nightEndTime: '07:00',
    }),
  })
  .strict();

export type SideSettings = z.infer<typeof SideSettingsSchema>;
export type Settings = z.infer<typeof SettingsSchema>;

// Update schema (deep partial for patch routes) - preserving validation constraints
export const SettingsUpdateSchema = z
  .object({
    timeZone: z.enum(TIME_ZONES).nullable().optional(),
    linkBothSides: z.boolean().optional(),
    left: z.object({
      name: z.string().min(1).max(20).optional(),
      awayMode: z.boolean().optional(),
      awayStart: z.string().datetime().nullable().optional(),
      awayReturn: z.string().datetime().nullable().optional(),
    }).strict().optional(),
    right: z.object({
      name: z.string().min(1).max(20).optional(),
      awayMode: z.boolean().optional(),
      awayStart: z.string().datetime().nullable().optional(),
      awayReturn: z.string().datetime().nullable().optional(),
    }).strict().optional(),
    lastPrime: z.string().datetime().optional(),
    primePodDaily: z
      .object({
        enabled: z.boolean().optional(),
        time: TimeSchema.optional(),
      })
      .optional(),
    temperatureFormat: Temperatures.optional(),
    rebootDaily: z.boolean().optional(),
    alarmButtonBehavior: AlarmButtonBehaviors.optional(),
    ledNightMode: z
      .object({
        enabled: z.boolean().optional(),
        dayBrightness: z.number().int().min(0).max(100).optional(),
        nightBrightness: z.number().int().min(0).max(100).optional(),
        nightStartTime: TimeSchema.optional(),
        nightEndTime: TimeSchema.optional(),
      })
      .optional(),
  })
  .strict();

export type SettingsUpdate = z.infer<typeof SettingsUpdateSchema>;
