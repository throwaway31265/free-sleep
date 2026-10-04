
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="cde4a5a0-2480-5532-b952-a8ca568c8dce")}catch(e){}}();
import { z } from 'zod';
export const JobSchema = z.enum([
    'analyzeSleepLeft',
    'analyzeSleepRight',
    'biometricsCalibrationLeft',
    'biometricsCalibrationRight',
    'reboot',
    'update',
]);
// Schema for a list (array) of valid job keys
export const JobKeyListSchema = z.array(JobSchema);
//# sourceMappingURL=jobsSchema.js.map
//# debugId=cde4a5a0-2480-5532-b952-a8ca568c8dce
