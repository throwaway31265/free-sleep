import express from 'express';
import moment from 'moment-timezone';
import { z } from 'zod';
import logger from '../../logger.js';
import settingsDB from '../../db/settings.js';
const router = express.Router();
const PresenceSideSchema = z.object({
    present: z.boolean(),
    lastUpdatedAt: z.string().optional(),
});
export const PresenceDataSchema = z.object({
    left: PresenceSideSchema.optional(),
    right: PresenceSideSchema.optional(),
});
// In-memory storage for presence data
// Default values are null until first update
const presenceData = {
    left: {
        present: false,
        lastUpdatedAt: moment.tz(settingsDB.data.timeZone).format(),
    },
    right: {
        present: false,
        lastUpdatedAt: moment.tz(settingsDB.data.timeZone).format(),
    },
};
/**
 * POST /presence
 * Update presence data for one or both sides
 */
router.post('/presence', async (req, res) => {
    try {
        await settingsDB.read();
        const { body } = req;
        const validationResult = PresenceDataSchema.deepPartial().safeParse(body);
        if (!validationResult.success) {
            logger.error('Invalid device status update:', validationResult.error);
            res.status(400).json({
                error: 'Invalid request data',
                details: validationResult?.error?.errors,
            });
            return;
        }
        // Check if at least one side is provided
        if (!body.left && !body.right) {
            return res.status(400).json({
                error: 'At least one side (left or right) must be specified',
                message: 'Please provide "left" and/or "right" with boolean values'
            });
        }
        const currentTime = moment.tz(settingsDB.data.timeZone).format();
        // Update left side if provided
        if (body.left) {
            presenceData.left.present = body.left.present;
            presenceData.left.lastUpdatedAt = currentTime;
        }
        // Update right side if provided
        if (body.right) {
            presenceData.right.present = body.right.present;
            presenceData.right.lastUpdatedAt = currentTime;
        }
        return res.status(200).json(presenceData);
    }
    catch (error) {
        console.error('Error updating presence:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});
/**
 * GET /presence
 */
router.get('/presence', (req, res) => {
    return res.status(200).json(presenceData);
});
export default router;
//# sourceMappingURL=presence.js.map