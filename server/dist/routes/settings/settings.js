import _ from 'lodash';
import express from 'express';
import logger from '../../logger.js';
const router = express.Router();
import settingsDB from '../../db/settings.js';
import { SettingsSchema } from '../../db/settingsSchema.js';
// import { executeAnalyzeSleep } from '../../jobs/analyzeSleep.js';
// import { executeCalibrateSensors } from '../../jobs/calibrateSensors';
router.get('/settings', async (req, res) => {
    await settingsDB.read();
    res.json(settingsDB.data);
});
router.post('/settings', async (req, res) => {
    const side = 'left';
    // const startTime = new Date('2025-02-05T04:00:00Z').toISOString();
    const startTime = new Date('2025-02-05T17:00:00Z').toISOString();
    // const endTime = new Date('2025-02-05T15:00:00Z').toISOString();
    const endTime = new Date('2025-02-05T20:00:00Z').toISOString();
    // executeCalibrateSensors(side, startTime, endTime);
    const { body } = req;
    const validationResult = SettingsSchema.deepPartial().safeParse(body);
    if (!validationResult.success) {
        logger.error('Invalid settings update:', validationResult.error);
        res.status(400).json({
            error: 'Invalid request data',
            details: validationResult?.error?.errors,
        });
        return;
    }
    await settingsDB.read();
    _.merge(settingsDB.data, body);
    await settingsDB.write();
    res.status(200).json(settingsDB.data);
});
export default router;
