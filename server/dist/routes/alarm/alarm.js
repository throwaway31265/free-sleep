
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="92fe727d-7f1a-57be-a8a7-a6d0e52f30c4")}catch(e){}}();
import express from 'express';
import { AlarmJobSchema, } from '../../db/schedulesSchema.js';
import logger from '../../logger.js';
import schedulesDB from '../../db/schedules.js';
import { executeAlarm } from '../../jobs/alarmScheduler.js';
const router = express.Router();
router.post('/alarm', async (req, res) => {
    const body = req.body;
    const validationResult = AlarmJobSchema.safeParse(body);
    if (!validationResult.success) {
        logger.error('Invalid schedules update:', validationResult.error);
        res.status(400).json({
            error: 'Invalid request data',
            details: validationResult?.error?.errors,
        });
        return;
    }
    const alarmJob = validationResult.data;
    void executeAlarm(alarmJob);
    res.status(200).json(schedulesDB.data);
});
export default router;
//# sourceMappingURL=alarm.js.map
//# debugId=92fe727d-7f1a-57be-a8a7-a6d0e52f30c4
