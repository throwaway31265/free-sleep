import { PrismaClient } from '@prisma/client';
import express from 'express';
import schedule from 'node-schedule';
import logger from './logger.js';
import { getFranken, getFrankenServer } from './8sleep/frankenServer.js';
import './jobs/jobScheduler.js';
// Setup code
import setupMiddleware from './setup/middleware.js';
import setupRoutes from './setup/routes.js';
import config from './config.js';
import serverStatus from './serverStatus.js';
const port = 3000;
const app = express();
let server;
const prisma = new PrismaClient();
async function disconnectPrisma() {
    try {
        logger.debug('Flushing SQLite');
        // Flush WAL into main DB and truncate WAL file (no-op if not in WAL mode)
        await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)');
        logger.debug('Flushed SQLite');
    }
    catch (error) {
        logger.error('Error flushing SQLite');
        const message = error instanceof Error ? error.message : String(error);
        logger.error(message);
    }
    try {
        logger.debug('Disconnecting Prisma');
        await prisma.$disconnect();
        logger.debug('Disconnected Prisma');
    }
    catch (error) {
        logger.error('Error disconnecting from Prisma');
        const message = error instanceof Error ? error.message : String(error);
        logger.error(message);
    }
}
// Graceful Shutdown Function
async function gracefulShutdown(signal) {
    logger.debug(`\nReceived ${signal}. Initiating graceful shutdown...`);
    let finishedExiting = false;
    // Force shutdown after 10 seconds
    setTimeout(() => {
        if (finishedExiting)
            return;
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
            const franken = await getFranken();
            const frankenServer = await getFrankenServer();
            // Close the Franken instance and server
            franken.close();
            await frankenServer.close();
            logger.debug('Successfully closed Franken & FrankenServer.');
        }
    }
    catch (err) {
        logger.error(`Error during shutdown: ${err}`);
    }
    finishedExiting = true;
    logger.debug('Exiting now...');
    process.exit(0);
}
// Initialize Franken on server startup
async function initFranken() {
    logger.info('Initializing Franken on startup...');
    serverStatus.franken.status = 'started';
    // Force creation of the Franken and FrankenServer so it’s ready before we listen
    await getFranken();
    serverStatus.franken.status = 'healthy';
    logger.info('Franken has been initialized successfully.');
}
// Main startup function
async function startServer() {
    setupMiddleware(app);
    setupRoutes(app);
    // Listen on desired port
    server = app.listen(port, () => {
        logger.debug(`Server running on http://localhost:${port}`);
    });
    serverStatus.express.status = 'healthy';
    // Initialize Franken once before listening
    if (!config.remoteDevMode) {
        initFranken()
            .catch(error => {
            serverStatus.franken.status = 'failed';
            const message = error instanceof Error ? error.message : String(error);
            serverStatus.franken.message = message;
            logger.error(error);
        });
    }
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
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        await gracefulShutdown('unhandledRejection');
    });
}
// Actually start the server
startServer().catch((err) => {
    logger.error('Failed to start server:', err);
    process.exit(1);
});
