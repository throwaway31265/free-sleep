import express from 'express';
import logger from '../../logger.js';
import { executeAnalyzeSleep } from '../../jobs/analyzeSleep.js';
import { executeCalibrateSensors } from '../../jobs/calibrateSensors.js';
import moment from 'moment-timezone';
import { JobKeyListSchema } from './jobsSchema.js';
import update from '../../jobs/update.js';
import reboot from '../../jobs/reboot.js';
const router = express.Router();
const analyzeSleepLeft = () => executeAnalyzeSleep('left', moment().subtract(12, 'hours').toISOString(), moment().add(1, 'hours').toISOString());
const analyzeSleepRight = () => executeAnalyzeSleep('right', moment().subtract(12, 'hours').toISOString(), moment().add(1, 'hours').toISOString());
const biometricsCalibrationLeft = () => executeCalibrateSensors('left', moment().subtract(2, 'hours').toISOString(), moment().add(1, 'hours').toISOString());
const biometricsCalibrationRight = () => executeCalibrateSensors('right', moment().subtract(2, 'hours').toISOString(), moment().add(1, 'hours').toISOString());
const JOB_MAP = {
    analyzeSleepLeft,
    analyzeSleepRight,
    biometricsCalibrationLeft,
    biometricsCalibrationRight,
    reboot,
    update,
};
router.post('/jobs', async (req, res) => {
    const { body } = req;
    const validationResult = JobKeyListSchema.safeParse(body);
    if (!validationResult.success) {
        logger.error('Invalid jobs:', validationResult.error);
        res.status(400).json({
            error: 'Invalid request data',
            details: validationResult?.error?.errors,
        });
        return;
    }
    body.forEach((job) => {
        JOB_MAP[job]();
    });
    res.status(204).end();
});
export default router;
//# sourceMappingURL=jobs.js.map