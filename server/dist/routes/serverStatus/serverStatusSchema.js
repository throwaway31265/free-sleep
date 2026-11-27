// WARNING! - Any changes here MUST be the same between app/src/api & server/src/db/
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