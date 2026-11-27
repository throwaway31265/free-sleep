// WARNING! - Any changes here MUST be the same between app/src/api & server/src/db/
import { z } from 'zod';
import { StatusInfoSchema } from '../routes/serverStatus/serverStatusSchema.js';
export const ServicesSchema = z.object({
    biometrics: z.object({
        enabled: z.boolean(),
        jobs: z.object({
            analyzeSleepLeft: StatusInfoSchema,
            analyzeSleepRight: StatusInfoSchema,
            installation: StatusInfoSchema,
            stream: StatusInfoSchema,
            calibrateLeft: StatusInfoSchema,
            calibrateRight: StatusInfoSchema,
        }),
    }),
    sentryLogging: z.object({
        enabled: z.boolean(),
    }),
}).strict();
//# sourceMappingURL=servicesSchema.js.map