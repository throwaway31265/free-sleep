
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="d9530bdf-32d3-5674-b723-6a96afb44ed4")}catch(e){}}();
import * as Sentry from '@sentry/node';
import _ from 'lodash';
import express from 'express';
import logger from '../../logger.js';
const router = express.Router();
import servicesDB from '../../db/services.js';
import { ServicesSchema } from '../../db/servicesSchema.js';
import { initSentry } from '../../instrument.js';
import { setupSentryTags } from '../../setupSentryTags.js';
router.get('/services', async (req, res) => {
    await servicesDB.read();
    res.json(servicesDB.data);
});
router.post('/services', async (req, res) => {
    const { body } = req;
    const validationResult = ServicesSchema.deepPartial().safeParse(body);
    if (!validationResult.success) {
        logger.error('Invalid services update:', validationResult.error);
        res.status(400).json({
            error: 'Invalid request data',
            details: validationResult?.error?.errors,
        });
        return;
    }
    if (body?.sentryLogging?.enabled === false) {
        logger.debug('Disabling sentry...');
        void Sentry.close();
    }
    else if (body?.sentryLogging?.enabled === true) {
        logger.debug('Enabling sentry...');
        initSentry();
        void setupSentryTags();
    }
    await servicesDB.read();
    _.merge(servicesDB.data, body);
    await servicesDB.write();
    res.status(200).json(servicesDB.data);
});
export default router;
//# sourceMappingURL=services.js.map
//# debugId=d9530bdf-32d3-5674-b723-6a96afb44ed4
