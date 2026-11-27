import { z } from 'zod';
import { SideSchema } from './schedulesSchema.js';
export const vitalsRecordSchema = z.object({
    side: SideSchema,
    timestamp: z.number().int(), // Epoch timestamp
    heart_rate: z.number().int().min(30).max(90),
    hrv: z.number().int().min(0).max(200),
    breathing_rate: z.number().int().min(5).max(30), // Normal breathing rate range
});
//# sourceMappingURL=vitalsRecordSchema.js.map