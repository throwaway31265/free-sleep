import express from 'express';
import { connectFranken } from '../../8sleep/frankenServer.js';
import { DeviceStatusSchema } from './deviceStatusSchema.js';
import logger from '../../logger.js';
import { updateDeviceStatus } from './updateDeviceStatus.js';
import { SideSchema } from '../../db/schedulesSchema.js';
import { noteSetpoint } from '../../autopilot/state.js';
const router = express.Router();
router.get('/deviceStatus', async (req, res) => {
    const franken = await connectFranken();
    const resp = await franken.getDeviceStatus();
    res.json(resp);
});
router.post('/deviceStatus', async (req, res) => {
    const { body } = req;
    const validationResult = DeviceStatusSchema.deepPartial().safeParse(body);
    if (!validationResult.success) {
        logger.error('Invalid device status update:', validationResult.error);
        res.status(400).json({
            error: 'Invalid request data',
            details: validationResult?.error?.errors,
        });
        return;
    }
    // Manual changes become the autopilot anchor and start a hold
    for (const side of SideSchema.options) {
        const targetTemperatureF = validationResult.data[side]?.targetTemperatureF;
        if (typeof targetTemperatureF === 'number')
            noteSetpoint(side, targetTemperatureF, 'manual');
    }
    await updateDeviceStatus(body);
    res.status(204).end();
});
export default router;
//# sourceMappingURL=deviceStatus.js.map