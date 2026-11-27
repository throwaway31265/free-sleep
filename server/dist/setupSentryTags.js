import * as Sentry from '@sentry/node';
import logger from './logger.js';
import { connectFranken } from './8sleep/frankenServer.js';
import './jobs/jobScheduler.js';
import settingsDB from './db/settings.js';
export async function setupSentryTags() {
    logger.debug('Setting up sentry tags');
    const franken = await connectFranken();
    const deviceStatus = await franken.getDeviceStatus();
    Sentry.setUser({ id: settingsDB.data.id });
    Sentry.setTag('hub_version', deviceStatus.hubVersion);
    Sentry.setTag('cover_version', deviceStatus.coverVersion);
    logger.debug('Set up sentry tags');
}
//# sourceMappingURL=setupSentryTags.js.map