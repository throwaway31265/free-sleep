// WARNING! - Any changes here MUST be the same between app/src/api & server/src/db/

import { z } from 'zod';

const timeRegexFormat = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Reusable Zod type for time
export const TimeSchema = z
  .string()
  .regex(timeRegexFormat, 'Invalid time format, must be HH:mm');
export const TemperatureSchema = z.number().int().min(55).max(110);

// Base elevation schemas
export const BasePositionSchema = z.object({
  head: z.number().min(0).max(60),
  feet: z.number().min(0).max(45),
  feedRate: z.number().min(30).max(100).optional().default(50),
});

export const BasePresetSchema = z.enum(['flat', 'sleep', 'relax', 'read']);

export const BaseElevationSchema = z.union([
  BasePositionSchema,
  z.object({
    preset: BasePresetSchema,
  }),
]);

export const AlarmSchema = z
  .object({
    time: TimeSchema,
    vibrationIntensity: z.number().int().min(1).max(100),
    vibrationPattern: z.enum(['double', 'rise']),
    duration: z.number().int().positive().min(0).max(180),
    enabled: z.boolean(),
    alarmTemperature: TemperatureSchema,
  })
  .strict();

export const DailyScheduleSchema = z
  .object({
    temperatures: z.record(TimeSchema, TemperatureSchema),
    alarm: AlarmSchema,
    power: z.object({
      on: TimeSchema,
      off: TimeSchema,
      onTemperature: TemperatureSchema,
      enabled: z.boolean(),
    }),
    elevations: z.record(TimeSchema, BaseElevationSchema),
  })
  .strict();

// Define the SideSchedule schema
export const SideScheduleSchema = z
  .object({
    sunday: DailyScheduleSchema,
    monday: DailyScheduleSchema,
    tuesday: DailyScheduleSchema,
    wednesday: DailyScheduleSchema,
    thursday: DailyScheduleSchema,
    friday: DailyScheduleSchema,
    saturday: DailyScheduleSchema,
  })
  .strict();

// Define the Schedules schema
export const SchedulesSchema = z
  .object({
    left: SideScheduleSchema,
    right: SideScheduleSchema,
  })
  .strict();

export type DailySchedule = z.infer<typeof DailyScheduleSchema>;
export type SideSchedule = z.infer<typeof SideScheduleSchema>;
export type Schedules = z.infer<typeof SchedulesSchema>;
export type Time = z.infer<typeof TimeSchema>;
export type BaseElevation = z.infer<typeof BaseElevationSchema>;
export type BasePosition = z.infer<typeof BasePositionSchema>;
export type BasePreset = z.infer<typeof BasePresetSchema>;
// eslint-disable-next-line @typescript-eslint/no-type-alias
export type DayOfWeek = keyof SideSchedule;
// eslint-disable-next-line @typescript-eslint/no-type-alias
export type Side = keyof Schedules;
