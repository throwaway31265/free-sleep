
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="e722ce6c-48bd-579b-b918-49d2807e4eda")}catch(e){}}();
import { z } from 'zod';
import { SideSchema } from './schedulesSchema.js';
export const movementRecordSchema = z.object({
    id: z.number(),
    side: SideSchema,
    timestamp: z.number().int(), // Epoch timestamp
    total_movement: z.number().int()
});
//# sourceMappingURL=movementRecordSchema.js.map
//# debugId=e722ce6c-48bd-579b-b918-49d2807e4eda
