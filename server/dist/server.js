import express from 'express';
import schedule from 'node-schedule';
import logger from './logger.js';
import { getFranken, getFrankenServer } from './8sleep/frankenServer.js';
import './jobs/jobScheduler.js';
// Setup code
import setupMiddleware from './setup/middleware.js';
import setupRoutes from './setup/routes.js';
import config from './config.js';
const port = 3000;
const app = express();
let server;
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
    }, 10_000);
    await schedule.gracefulShutdown();
    // If we already got Franken instances, close them
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
    // Force creation of the Franken and FrankenServer so it’s ready before we listen
    await getFrankenServer();
    await getFranken();
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
    // Initialize Franken once before listening
    if (!config.remoteDevMode) {
        initFranken()
            .then(resp => {
            logger.info(resp);
        })
            .catch(error => {
            logger.error(error);
        });
    }
    ;
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
