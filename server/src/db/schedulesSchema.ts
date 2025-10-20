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

// Update schemas (deep partial for patch routes) - preserving validation constraints
export const DailyScheduleUpdateSchema = z
  .object({
    temperatures: z.record(TimeSchema, TemperatureSchema).optional(),
    alarm: z.object({
      time: TimeSchema.optional(),
      vibrationIntensity: z.number().int().min(1).max(100).optional(),
      vibrationPattern: z.enum(['double', 'rise']).optional(),
      duration: z.number().int().positive().min(0).max(180).optional(),
      enabled: z.boolean().optional(),
      alarmTemperature: TemperatureSchema.optional(),
    }).strict().optional(),
    power: z
      .object({
        on: TimeSchema.optional(),
        off: TimeSchema.optional(),
        onTemperature: TemperatureSchema.optional(),
        enabled: z.boolean().optional(),
      })
      .optional(),
    elevations: z.record(TimeSchema, BaseElevationSchema).optional(),
  })
  .strict();

export const SideScheduleUpdateSchema = z
  .object({
    sunday: DailyScheduleUpdateSchema.optional(),
    monday: DailyScheduleUpdateSchema.optional(),
    tuesday: DailyScheduleUpdateSchema.optional(),
    wednesday: DailyScheduleUpdateSchema.optional(),
    thursday: DailyScheduleUpdateSchema.optional(),
    friday: DailyScheduleUpdateSchema.optional(),
    saturday: DailyScheduleUpdateSchema.optional(),
  })
  .strict();

export const SchedulesUpdateSchema = z
  .object({
    left: SideScheduleUpdateSchema.optional(),
    right: SideScheduleUpdateSchema.optional(),
  })
  .strict();

export type DailyScheduleUpdate = z.infer<typeof DailyScheduleUpdateSchema>;
export type SideScheduleUpdate = z.infer<typeof SideScheduleUpdateSchema>;
export type SchedulesUpdate = z.infer<typeof SchedulesUpdateSchema>;

// ============================================================================
// V2 Schema: Schedule Entity Model
// ============================================================================

// Schedule Entity - stores schedule data with unique ID
export const ScheduleEntitySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().optional(),
    data: DailyScheduleSchema,
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .strict();

export type ScheduleEntity = z.infer<typeof ScheduleEntitySchema>;

// V2 Side Schedule - adds schedule entities and assignments
export const SideScheduleV2Schema = z
  .object({
    // Legacy: For backward compatibility and job consumption
    sunday: DailyScheduleSchema,
    monday: DailyScheduleSchema,
    tuesday: DailyScheduleSchema,
    wednesday: DailyScheduleSchema,
    thursday: DailyScheduleSchema,
    friday: DailyScheduleSchema,
    saturday: DailyScheduleSchema,

    // New: For efficient storage and group operations
    schedules: z.record(z.string().uuid(), ScheduleEntitySchema).optional(),
    assignments: z.record(z.string(), z.string().uuid()).optional(),

    // Schedule mode: determines how schedules are managed
    mode: z.enum(['day-specific', 'basic']).optional().default('day-specific'),
    // Active schedule for basic mode (applies to all days)
    activeScheduleId: z.string().uuid().optional(),
  })
  .strict();

export type SideScheduleV2 = z.infer<typeof SideScheduleV2Schema>;

// V2 Schedules - uses V2 side schedules
export const SchedulesV2Schema = z
  .object({
    left: SideScheduleV2Schema,
    right: SideScheduleV2Schema,
  })
  .strict();

export type SchedulesV2 = z.infer<typeof SchedulesV2Schema>;
