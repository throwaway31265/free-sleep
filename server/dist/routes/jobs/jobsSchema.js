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