import { z } from 'zod';

export const sleepRecordSchema = z.object({
  id: z.number().int(),
  side: z.string(),
  entered_bed_at: z.string().datetime(),
  left_bed_at: z.string().datetime(),
  sleep_period_seconds: z.number().int(),
  times_exited_bed: z.number().int(),
  present_intervals: z.array(
    z.tuple([z.string().datetime(), z.string().datetime()]),
  ),
  not_present_intervals: z.array(
    z.tuple([z.string().datetime(), z.string().datetime()]),
  ),
});

// TypeScript type inference from Zod
export type SleepRecord = z.infer<typeof sleepRecordSchema>;

// Update schema for partial record updates - preserving validation constraints
export const sleepRecordUpdateSchema = z.object({
  id: z.number().int().optional(),
  side: z.string().optional(),
  entered_bed_at: z.string().datetime().optional(),
  left_bed_at: z.string().datetime().optional(),
  sleep_period_seconds: z.number().int().optional(),
  times_exited_bed: z.number().int().optional(),
  present_intervals: z.array(
    z.tuple([z.string().datetime(), z.string().datetime()]),
  ).optional(),
  not_present_intervals: z.array(
    z.tuple([z.string().datetime(), z.string().datetime()]),
  ).optional(),
});
