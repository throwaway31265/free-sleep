// WARNING! - Any changes here MUST be the same between app/src/api & server/src/db/
import { z } from 'zod';

export const sleepRecordSchema = z.object({
  id: z.number().int(),
  side: z.string(),
  entered_bed_at: z.string().datetime(),
  left_bed_at: z.string().datetime(),
  sleep_period_seconds: z.number().int(),
  times_exited_bed: z.number().int(),
  present_intervals: z.array(z.tuple([z.string().datetime(), z.string().datetime()])),
  not_present_intervals: z.array(z.tuple([z.string().datetime(), z.string().datetime()])),
});

// TypeScript type inference from Zod
export type SleepRecord = z.infer<typeof sleepRecordSchema>;
