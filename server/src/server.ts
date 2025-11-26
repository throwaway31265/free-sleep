import './instrument.js';
import express from 'express';
import schedule from 'node-schedule';
import { Server } from 'http';
import logger from './logger.js';
import { connectFranken, disconnectFranken } from './8sleep/frankenServer.js';
import { FrankenMonitor } from './8sleep/frankenMonitor.js';
import { rawTapMonitor } from './8sleep/rawTapMonitor.js';
import { HUB_VERSION } from './8sleep/loadDeviceStatus.js';
import { Version } from './routes/deviceStatus/deviceStatusSchema.js';
import './jobs/jobScheduler.js';


// Setup code
import setupMiddleware from './setup/middleware.js';
import setupRoutes from './setup/routes.js';
import config from './config.js';
import serverStatus from './serverStatus.js';
import { prisma } from './db/prisma.js';
import { setupSentryTags } from './setupSentryTags.js';
import { loadWifiSignalStrength } from './8sleep/wifiSignalStrength.js';

const port = 3000;
const app = express();
let server: Server | undefined;
let frankenMonitor: FrankenMonitor | undefined;

async function disconnectPrisma() {
  try {
    logger.debug('Flushing SQLite');
    // Flush WAL into main DB and truncate WAL file (no-op if not in WAL mode)
    await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)');
    logger.debug('Flushed SQLite');
  } catch (error) {
    logger.error('Error flushing SQLite');
    const message = error instanceof Error ? error.message : String(error);
    logger.error(message);
  }
  try {
    logger.debug('Disconnecting Prisma');
    await prisma.$disconnect();
    logger.debug('Disconnected Prisma');
  } catch (error) {
    logger.error('Error disconnecting from Prisma');
    const message = error instanceof Error ? error.message : String(error);
    logger.error(message);
  }
}


// Graceful Shutdown Function
async function gracefulShutdown(signal: string) {
  logger.debug(`\nReceived ${signal}. Initiating graceful shutdown...`);
  let finishedExiting = false;

  // Force shutdown after 10 seconds
  setTimeout(() => {
    if (finishedExiting) return;
    const error = new Error('Could not close connections in time. Forcing shutdown.');
    logger.error({ error });
    process.exit(1);
  }, 15_000);
  logger.debug('Stopping node-schedule');
  await schedule.gracefulShutdown();
  await disconnectPrisma();


  try {
    if (server) {
      // Stop accepting new connections
      server.close(() => {
        logger.debug('Closed out remaining HTTP connections.');
      });
    }

    if (!config.remoteDevMode) {
      frankenMonitor?.stop();
      rawTapMonitor.stop();
      await disconnectFranken();
      logger.debug('Successfully closed Franken components.');
    }
  } catch (err) {
    logger.error(`Error during shutdown: ${err}`);
  }

  finishedExiting = true;
  logger.debug('Exiting now...');
  process.exit(0);
}

// Initialize Franken on server startup
async function initFranken() {
  logger.info('Initializing Franken on startup...');
  serverStatus.status.franken.status = 'started';
  // Force creation of the Franken and FrankenServer so it’s ready before we listen
  await connectFranken();

  serverStatus.status.franken.status = 'healthy';
  logger.info('Franken has been initialized successfully.');
}


const initFrankenMonitor = () => {
  logger.info('Starting franken monitor...');
  serverStatus.status.frankenMonitor.status = 'started';
  frankenMonitor = new FrankenMonitor();
  void frankenMonitor.start();
  logger.info('Frank monitor started!');
};

const initRawTapMonitor = async () => {
  // RawTapMonitor is only needed for Pod 3 hub with Pod 4+ cover
  // Pod 3 hub doesn't relay tap events via socket for newer covers
  const franken = await connectFranken();
  const deviceStatus = await franken.getDeviceStatus(false);
  const coverVersion = deviceStatus.coverVersion;

  const isPod3Hub = HUB_VERSION === Version.Pod3;
  const hasPod4PlusCover = coverVersion === Version.Pod4 || coverVersion === Version.Pod5;

  if (isPod3Hub && hasPod4PlusCover) {
    logger.info(`Starting RAW tap monitor (hub: ${HUB_VERSION}, cover: ${coverVersion})...`);
    await rawTapMonitor.start();
    logger.info('RAW tap monitor started!');
  } else {
    logger.info(`RAW tap monitor not needed (hub: ${HUB_VERSION}, cover: ${coverVersion})`);
  }
};


// Main startup function
async function startServer() {
  setupMiddleware(app);
  setupRoutes(app);
  // Listen on desired port
  server = app.listen(port, () => {
    logger.debug(`Server running on http://localhost:${port}`);
  });
  serverStatus.status.express.status = 'healthy';
  serverStatus.status.logger.status = 'healthy';

  // Initialize Franken once before listening
  if (!config.remoteDevMode) {
    void initFranken()
      .then(async () => {
        setupSentryTags();
        initFrankenMonitor();
        await initRawTapMonitor();
      })
      .catch(error => {
        serverStatus.status.franken.status = 'failed';
        const message = error instanceof Error ? error.message : String(error);
        serverStatus.status.franken.message = message;

        logger.error(error);
      });
  }
  void loadWifiSignalStrength();
  setInterval(loadWifiSignalStrength, 10_000);

  // Register signal handlers for graceful shutdown
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions and rejections
  process.on('uncaughtException', async (err) => {
    console.error('Uncaught Exception:', err);
    logger.error(err);
    await gracefulShutdown('uncaughtException');
  });
  process.on('unhandledRejection', async (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    await gracefulShutdown('unhandledRejection');
  });
}

// Actually start the server
startServer().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
