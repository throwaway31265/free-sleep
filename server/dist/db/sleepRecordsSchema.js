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
//# sourceMappingURL=sleepRecordsSchema.js.map