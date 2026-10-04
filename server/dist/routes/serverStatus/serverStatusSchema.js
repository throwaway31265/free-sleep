// WARNING! - Any changes here MUST be the same between app/src/api & server/src/db/

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="86403e2b-51bc-50d5-85c9-ed554c77aec9")}catch(e){}}();
import { z } from 'zod';
const StatusSchema = z.enum([
    'failed',
    'healthy',
    'not_started',
    'restarting',
    'retrying',
    'started',
]);
export const StatusInfoSchema = z.object({
    name: z.string(),
    status: StatusSchema,
    description: z.string(),
    message: z.string(),
    timestamp: z.string().optional(),
});
//# sourceMappingURL=serverStatusSchema.js.map
//# debugId=86403e2b-51bc-50d5-85c9-ed554c77aec9
