
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="eaf48186-a5b6-54da-ab23-bdff5c9496c4")}catch(e){}}();
import _ from 'lodash';
import express from 'express';
import logger from '../../logger.js';
const router = express.Router();
import settingsDB from '../../db/settings.js';
import { SettingsSchema } from '../../db/settingsSchema.js';
router.get('/settings', async (req, res) => {
    await settingsDB.read();
    res.json(settingsDB.data);
});
router.post('/settings', async (req, res) => {
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
    delete body.id;
    await settingsDB.read();
    _.merge(settingsDB.data, body);
    await settingsDB.write();
    res.status(200).json(settingsDB.data);
});
export default router;
//# sourceMappingURL=settings.js.map
//# debugId=eaf48186-a5b6-54da-ab23-bdff5c9496c4
