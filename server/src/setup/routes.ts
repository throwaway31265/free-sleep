import express, { type Express } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import baseControl from '../routes/baseControl/baseControl.js';
import deviceStatus from '../routes/deviceStatus/deviceStatus.js';
import execute from '../routes/execute/execute.js';
import logs from '../routes/logs/logs.js';
import sleep from '../routes/metrics/sleep.js';
import vitals from '../routes/metrics/vitals.js';
import schedules from '../routes/schedules/schedules.js';
import settings from '../routes/settings/settings.js';
import version from '../routes/version/version.js';
import waterLevel from '../routes/waterLevel/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function (app: Express) {
  app.use('/api/', baseControl);
  app.use('/api/', deviceStatus);
  app.use('/api/', execute);
  app.use('/api/', schedules);
  app.use('/api/', settings);
  app.use('/api/', version);
  app.use('/api/', waterLevel);
  app.use('/api/metrics/', sleep);
  app.use('/api/metrics/', vitals);
  app.use('/api/logs', logs);
  // // Serve static files from the Vite output directory
  app.use(express.static(path.join(__dirname, '../../public')));

  // Catch-all route to serve the React app for any unknown route
  // Use a RegExp to avoid path-to-regexp parsing issues in Express 5
  app.get(/.*/, (req, res) => {
    res.sendFile(path.resolve(__dirname, '../../public', 'index.html'));
  });
}
