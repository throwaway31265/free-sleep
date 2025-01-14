// WARNING! - Any changes here MUST be the same between app/src/api & server/src/db/

import { z } from 'zod';
import { TIME_ZONES } from './timeZones';
import { TimeSchema } from './schedulesSchema';

export const TEMPERATURES = ['celsius', 'fahrenheit'] as const;
const Temperatures = z.enum(TEMPERATURES)
export type TemperatureFormat = z.infer<typeof Temperatures>;

const SideSettingsSchema = z.object({
  awayMode: z.boolean(),
}).strict();

export const SettingsSchema = z.object({
  timeZone: z.enum(TIME_ZONES).nullable(),
  left: SideSettingsSchema,
  right: SideSettingsSchema,
  primePodDaily: z.object({
    enabled: z.boolean(),
    time: TimeSchema,
  }),
  temperatureFormat: Temperatures,
}).strict();

export type SideSettings = z.infer<typeof SideSettingsSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
