// WARNING! - Any changes here MUST be the same between app/src/api & server/src/db/

import { z } from 'zod';

const SideStatusSchema = z
  .object({
    currentTemperatureF: z.number(),
    targetTemperatureF: z
      .number()
      .min(55, { message: 'Temperature must be at least 55°F' })
      .max(110, { message: 'Temperature cannot exceed 110°F' }),
    secondsRemaining: z.number(),
    isOn: z.boolean(),
    isAlarmVibrating: z.boolean(),
  })
  .strict();

export const DeviceStatusSchema = z
  .object({
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
  })
  .strict();

export type SideStatus = z.infer<typeof SideStatusSchema>;
export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;

// For update payloads, accept deep partials explicitly
const SideStatusUpdateSchema = SideStatusSchema.partial();

export const DeviceStatusUpdateSchema = z
  .object({
    left: SideStatusUpdateSchema.optional(),
    right: SideStatusUpdateSchema.optional(),
    waterLevel: z.string().optional(),
    isPriming: z.boolean().optional(),
    settings: z
      .object({
        v: z.number().optional(),
        gainLeft: z.number().optional(),
        gainRight: z.number().optional(),
        ledBrightness: z.number().optional(),
      })
      .optional(),
  })
  .strict();
