// WARNING! - Any changes here MUST be the same between app/src/api & server/src/db/

import { z } from 'zod';
import { TIME_ZONES } from './timeZones';
import { TEMPERATURE_FORMATS } from './temperatureFormats';
import { TimeSchema } from './schedulesSchema';

const SideSettingsSchema = z.object({
  awayMode: z.boolean(),
}).strict();

export const SettingsSchema = z.object({
  timeZone: z.enum(TIME_ZONES).nullable(),
  temperatureFormat: z.enum(TEMPERATURE_FORMATS).nullable(),
  left: SideSettingsSchema,
  right: SideSettingsSchema,
  primePodDaily: z.object({
    enabled: z.boolean(),
    time: TimeSchema,
  })
}).strict();

export type SideSettings = z.infer<typeof SideSettingsSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
