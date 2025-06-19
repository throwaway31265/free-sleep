// WARNING! - Any changes here MUST be the same between app/src/api & server/src/db/

import { z } from 'zod';

const SideStatusSchema = z.object({
  currentTemperatureLevel: z.number(),
  currentTemperatureF: z.number(),
  targetTemperatureLevel: z.number()
    .min(-100, { message: 'targetTemperatureLevel must be at least -100' })
    .max(100, { message: 'targetTemperatureLevel cannot exceed 100' }),
  targetTemperatureF: z.number()
    .min(55, { message: 'Temperature must be at least 55°F' })
    .max(110, { message: 'Temperature cannot exceed 110°F' }),
  secondsRemaining: z.number(),
  isOn: z.boolean(),
  isAlarmVibrating: z.boolean(),
}).strict();

export const DeviceStatusSchema = z.object({
  left: SideStatusSchema,
  right: SideStatusSchema,
  waterLevel: z.string(),
  isPriming: z.boolean(),
  settings: z.object({
    v: z.number(),
    gainLeft: z.number(),
    gainRight: z.number(),
    ledBrightness: z.number(),
  }),
}).strict();

export type SideStatus = z.infer<typeof SideStatusSchema>;
export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;
