// WARNING! - Any changes here MUST be the same between app/src/api & server/src/db/

import { z } from 'zod';

// Temperature limits in Fahrenheit
export const MIN_TEMPERATURE_F = 55;
export const MAX_TEMPERATURE_F = 110;

const SideStatusSchema = z
  .object({
    currentTemperatureF: z.number(),
    targetTemperatureF: z
      .number()
      .min(MIN_TEMPERATURE_F, { message: `Temperature must be at least ${MIN_TEMPERATURE_F}°F` })
      .max(MAX_TEMPERATURE_F, { message: `Temperature cannot exceed ${MAX_TEMPERATURE_F}°F` }),
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
    waterLevelRaw: z.object({
      raw: z.number().optional(),
      calibratedEmpty: z.number().optional(),
      calibratedFull: z.number().optional(),
      timestamp: z.number().optional(),
    }).optional(),
    roomClimate: z.object({
      temperatureC: z.number().optional(),
      humidity: z.number().optional(),
      timestamp: z.number().optional(),
    }).optional(),
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

// For update payloads, accept deep partials explicitly while preserving validation
const SideStatusUpdateSchema = z.object({
  currentTemperatureF: z.number().optional(),
  targetTemperatureF: z
    .number()
    .min(MIN_TEMPERATURE_F, { message: `Temperature must be at least ${MIN_TEMPERATURE_F}°F` })
    .max(MAX_TEMPERATURE_F, { message: `Temperature cannot exceed ${MAX_TEMPERATURE_F}°F` })
    .optional(),
  secondsRemaining: z.number().optional(),
  isOn: z.boolean().optional(),
  isAlarmVibrating: z.boolean().optional(),
}).strict();

export const DeviceStatusUpdateSchema = z
  .object({
    left: SideStatusUpdateSchema.optional(),
    right: SideStatusUpdateSchema.optional(),
    waterLevel: z.string().optional(),
    isPriming: z.boolean().optional(),
    waterLevelRaw: z.object({
      raw: z.number().optional(),
      calibratedEmpty: z.number().optional(),
      calibratedFull: z.number().optional(),
      timestamp: z.number().optional(),
    }).optional(),
    roomClimate: z.object({
      temperatureC: z.number().optional(),
      humidity: z.number().optional(),
      timestamp: z.number().optional(),
    }).optional(),
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
