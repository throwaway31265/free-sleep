import express, { Express } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import deviceStatus from '../routes/deviceStatus/deviceStatus.js';
import execute from '../routes/execute/execute.js';
import settings from '../routes/settings/settings.js';
import schedules from '../routes/schedules/schedules.js';
import sleep from '../routes/metrics/sleep.js';
import movement from '../routes/metrics/movement.js';
import vitals from '../routes/metrics/vitals.js';
import logs from '../routes/logs/logs.js';
import serverStatus from '../routes/serverStatus/serverStatus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function (app: Express) {
  app.use('/api/', deviceStatus);
  app.use('/api/', execute);
  app.use('/api/', schedules);
  app.use('/api/', settings);
  app.use('/api/metrics/', movement);
  app.use('/api/metrics/', sleep);
  app.use('/api/metrics/', vitals);
  app.use('/api/logs', logs);
  app.use('/api/serverStatus', serverStatus);
  // // Serve static files from the Vite output directory
  app.use(express.static(path.join(__dirname, '../../public')));

  // Catch-all route to serve the React app for any unknown route
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../../public', 'index.html'));
  });
}
