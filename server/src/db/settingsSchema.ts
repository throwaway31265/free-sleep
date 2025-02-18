import { z } from 'zod';
import { TIME_ZONES } from './timeZones.js';
import { TimeSchema } from './schedulesSchema.js';

export const TEMPERATURES = ['celsius', 'fahrenheit'] as const;
const Temperatures = z.enum(TEMPERATURES);
export type TemperatureFormat = z.infer<typeof Temperatures>;

const SideSettingsSchema = z.object({
  name: z.string().min(1).max(20),
  awayMode: z.boolean(),
}).strict();

export const SettingsSchema = z.object({
  timeZone: z.enum(TIME_ZONES).nullable(),
  left: SideSettingsSchema,
  right: SideSettingsSchema,
  lastPrime: z.string().datetime().optional(),
  primePodDaily: z.object({
    enabled: z.boolean(),
    time: TimeSchema,
  }),
  temperatureFormat: Temperatures,
}).strict();

export type SideSettings = z.infer<typeof SideSettingsSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
