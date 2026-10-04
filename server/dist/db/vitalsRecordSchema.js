
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="16c2b86b-d0c4-51b3-934b-222bd6b878a3")}catch(e){}}();
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
//# debugId=16c2b86b-d0c4-51b3-934b-222bd6b878a3
