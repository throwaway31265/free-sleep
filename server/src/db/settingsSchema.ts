import { z } from 'zod';
import { TimeSchema } from './schedulesSchema.js';
import { TIME_ZONES } from './timeZones.js';

export const TEMPERATURES = ['celsius', 'fahrenheit'] as const;
const Temperatures = z.enum(TEMPERATURES);
export type TemperatureFormat = z.infer<typeof Temperatures>;

const SideSettingsSchema = z
  .object({
    name: z.string().min(1).max(20),
    awayMode: z.boolean(),
    // Optional ISO datetime when away mode should automatically end
    awayReturn: z.string().datetime().nullable().optional(),
  })
  .strict();

export const SettingsSchema = z
  .object({
    timeZone: z.enum(TIME_ZONES).nullable(),
    left: SideSettingsSchema,
    right: SideSettingsSchema,
    lastPrime: z.string().datetime().optional(),
    primePodDaily: z.object({
      enabled: z.boolean(),
      time: TimeSchema,
    }),
    temperatureFormat: Temperatures,
    rebootDaily: z.boolean(),
  })
  .strict();

export type SideSettings = z.infer<typeof SideSettingsSchema>;
export type Settings = z.infer<typeof SettingsSchema>;

// Update schema (deep partial for patch routes) - preserving validation constraints
export const SettingsUpdateSchema = z
  .object({
    timeZone: z.enum(TIME_ZONES).nullable().optional(),
    left: z.object({
      name: z.string().min(1).max(20).optional(),
      awayMode: z.boolean().optional(),
      awayReturn: z.string().datetime().nullable().optional(),
    }).strict().optional(),
    right: z.object({
      name: z.string().min(1).max(20).optional(),
      awayMode: z.boolean().optional(),
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
  })
  .strict();

export type SettingsUpdate = z.infer<typeof SettingsUpdateSchema>;
