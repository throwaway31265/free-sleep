import { z } from 'zod';
import { SideSchema } from './schedulesSchema.js';
export const movementRecordSchema = z.object({
    id: z.number(),
    side: SideSchema,
    timestamp: z.number().int(), // Epoch timestamp
    total_movement: z.number().int()
});
//# sourceMappingURL=movementRecordSchema.js.map