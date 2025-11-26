
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="2f9ba382-fe29-5e71-b7eb-2918b37fb63d")}catch(e){}}();
import express from 'express';
import { connectFranken } from '../../8sleep/frankenServer.js';
import { DeviceStatusSchema } from './deviceStatusSchema.js';
import logger from '../../logger.js';
import { updateDeviceStatus } from './updateDeviceStatus.js';
import { frankenMonitor } from '../../8sleep/frankenMonitor.js';
const router = express.Router();
router.get('/deviceStatus', async (req, res) => {
    const franken = await connectFranken();
    const resp = await franken.getDeviceStatus();
    res.json(resp);
});
// SSE endpoint for real-time device status updates
router.get('/deviceStatus/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Send current status immediately if available
    const currentStatus = frankenMonitor.getDeviceStatus();
    if (currentStatus) {
        res.write(`data: ${JSON.stringify(currentStatus)}\n\n`);
    }
    // Subscribe to status updates
    const onStatusUpdate = (status) => {
        res.write(`data: ${JSON.stringify(status)}\n\n`);
    };
    frankenMonitor.on('deviceStatus', onStatusUpdate);
    // Clean up on client disconnect
    req.on('close', () => {
        frankenMonitor.off('deviceStatus', onStatusUpdate);
        res.end();
    });
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
    await updateDeviceStatus(body);
    res.status(204).end();
});
export default router;
//# sourceMappingURL=deviceStatus.js.map
//# debugId=2f9ba382-fe29-5e71-b7eb-2918b37fb63d
