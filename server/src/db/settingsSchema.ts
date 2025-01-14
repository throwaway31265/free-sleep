// WARNING! - Any changes here MUST be the same between app/src/api & server/src/db/

import { z } from 'zod';
import { TIME_ZONES } from './timeZones.js';
import { TimeSchema } from './schedulesSchema.js';

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
  analysisDaily: z.object({
    enabled: z.boolean(),
    time: TimeSchema,
    estimatedSleepStart: TimeSchema,
    estimatedSleepEnd: TimeSchema,
  })
}).strict();

export type SideSettings = z.infer<typeof SideSettingsSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
