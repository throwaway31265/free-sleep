import _ from 'lodash';
import express from 'express';
import logger from '../../logger.js';
import schedulesDB from '../../db/schedules.js';
import { SchedulesSchema, } from '../../db/schedulesSchema.js';
const router = express.Router();
router.get('/schedules', async (req, res) => {
    await schedulesDB.read();
    res.json(schedulesDB.data);
});
router.post('/schedules', async (req, res) => {
    const body = req.body;
    const validationResult = SchedulesSchema.deepPartial().safeParse(body);
    if (!validationResult.success) {
        logger.error('Invalid schedules update:', validationResult.error);
        res.status(400).json({
            error: 'Invalid request data',
            details: validationResult?.error?.errors,
        });
        return;
    }
    const schedules = validationResult.data;
    await schedulesDB.read();
    Object.entries(schedules).forEach(([side, sideSchedule]) => {
        Object.entries(sideSchedule).forEach(([day, schedule]) => {
            if (schedule.power) {
                _.merge(schedulesDB.data[side][day].power, schedule.power);
            }
            if (schedule.temperatures)
                schedulesDB.data[side][day].temperatures = schedule.temperatures;
            if (schedule.alarm)
                schedulesDB.data[side][day].alarm = schedule.alarm;
        });
    });
    await schedulesDB.write();
    res.status(200).json(schedulesDB.data);
});
export default router;
//# sourceMappingURL=schedules.js.map