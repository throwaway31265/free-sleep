import { z } from 'zod';
export const movementRecordSchema = z.object({
    side: z.enum(['right', 'left']),
    timestamp: z.number().int(), // Epoch timestamp
    total_movement: z.number().int()
});
