// WARNING! - Any changes here MUST be the same between app/src/api & server/src/db/

import { z } from 'zod';
import { MIN_TEMPERATURE_F } from '../../db/temperatureCurve.js';

const SideStatusSchema = z.object({
  currentTemperatureLevel: z.number(),
  currentTemperatureF: z.number(),
  targetTemperatureF: z.number()
    .min(MIN_TEMPERATURE_F, { message: `Temperature must be at least ${MIN_TEMPERATURE_F}°F` })
    // Up to the old maximum is still accepted and treated as the hottest setting
    .max(110, { message: 'Temperature cannot exceed 110°F' }),
  secondsRemaining: z.number(),
  isOn: z.boolean(),
  isAlarmVibrating: z.boolean(),
  taps: z.object({
    doubleTap: z.number(),
    tripleTap: z.number(),
    quadTap: z.number(),
  }).optional(),
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
  coverVersion: z.string(),
  hubVersion: z.string(),
  freeSleep: z.object({
    version: z.string(),
    branch: z.string(),
  }),
  wifiStrength: z.number(),
}).strict();

export type SideStatus = z.infer<typeof SideStatusSchema>;
export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;

export enum Version {
  NotFound = 'Version not found',
  Pod3 = 'Pod 3',
  Pod4 = 'Pod 4',
  Pod5 = 'Pod 5',
}
