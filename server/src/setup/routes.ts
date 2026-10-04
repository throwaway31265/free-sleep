import * as Sentry from '@sentry/node';

import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import deviceStatus from '../routes/deviceStatus/deviceStatus.js';
import alarm from '../routes/alarm/alarm.js';
import execute from '../routes/execute/execute.js';
import jobs from '../routes/jobs/jobs.js';
import settings from '../routes/settings/settings.js';
import services from '../routes/services/services.js';
import schedules from '../routes/schedules/schedules.js';
import sleep from '../routes/metrics/sleep.js';
import movement from '../routes/metrics/movement.js';
import vitals from '../routes/metrics/vitals.js';
import presence from '../routes/metrics/presence.js';
import logs from '../routes/logs/logs.js';
import serverStatus from '../routes/serverStatus/serverStatus.js';
import logger from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function (app: Express) {
  logger.debug('Registering routes...');
  app.use('/api/', alarm);
  app.use('/api/', deviceStatus);
  app.use('/api/', execute);
  app.use('/api/', schedules);
  app.use('/api/', jobs);
  app.use('/api/', settings);
  app.use('/api/', services);
  app.use('/api/metrics/', movement);
  app.use('/api/metrics/', sleep);
  app.use('/api/metrics/', vitals);
  app.use('/api/metrics/', presence);
  app.use('/api/logs', logs);
  app.use('/api/serverStatus', serverStatus);
  app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({ error: { message: 'Not Found' } });
  });


  // --- JSON parse / body parser errors (normalize to 400)
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    // If this isn't a body-parse error, pass it on to the central handler
    if (err?.type !== 'entity.parse.failed') return next(err);
    res.status(400).json({ error: { message: 'Invalid JSON' } });
  });
  Sentry.setupExpressErrorHandler(app);

  // --- Central error handler (must be AFTER routes and special-case handlers)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const isProd = process.env.NODE_ENV === 'production';
    const status = Number(err?.status) || 500;
    const body: any = { error: { message: err?.message || 'Internal Server Error' } };
    if (!isProd) body.error.stack = err?.stack;
    logger.error(body);
    logger.error(JSON.stringify(body));
    res.status(status).json(body);
  });

  // --- Static files for the SPA
  app.use(express.static(path.join(__dirname, '../../public')));

  // --- SPA catch-all (MUST be last)
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.resolve(__dirname, '../../public', 'index.html'));
  });
  logger.debug('Registered routes!');
}
