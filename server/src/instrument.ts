import * as Sentry from '@sentry/node';
import servicesDB from './db/services.js';
import serverInfo from './serverInfo.json' with { type: 'json' };
import logger from './logger.js';



const inDevMode = process.env.MODE === 'dev' || process.env.ENV === 'local';

export const initSentry = () => {
  logger.debug('Initializing sentry...');
  Sentry.init({
    dsn: 'https://228d64fe4724349cb4a82b982c7b1133@o4510246020710401.ingest.us.sentry.io/4510252638666752',
    // Preserve the restrictive data collection used before Sentry 11.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
        response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      },
      httpBodies: [],
      urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      graphQL: { document: false, variables: false },
      frameContextLines: 7,
    },
    traceLifecycle: 'static',
    tracesSampleRate: 1.0,
    initialScope: {
      tags: {
        ...serverInfo,
        environment: inDevMode ? 'development' : 'production',
      }
    },
  });
};

await servicesDB.read();
// if (!inDevMode && servicesDB.data.sentryLogging.enabled) {
if (servicesDB.data.sentryLogging.enabled) {
  initSentry();
}
