import fs from 'fs';
import path from 'path';
import winston from 'winston';
import moment from 'moment';
import serverStatus from './serverStatus.js';
const logDir = '/persistent/free-sleep-data/logs';
const logFile = path.join(logDir, 'free-sleep.log');
// Try to create directory, or fall back to console only
let fileTransport;
try {
    fs.mkdirSync(logDir, { recursive: true });
    // Test write access
    fs.accessSync(logDir, fs.constants.W_OK);
    fileTransport = new winston.transports.File({
        filename: logFile,
        maxsize: 7 * 1024 * 1024,
        maxFiles: 1,
        tailable: true,
    });
    serverStatus.logger.status = 'healthy';
}
catch (error) {
    const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'string'
            ? error
            : 'Unknown error';
    const message = `Logger cannot write to ${logDir}, file logging disabled: ${errorMessage}`;
    console.warn(message);
    serverStatus.logger.status = 'failed';
    serverStatus.logger.message = message;
}
const transports = [
    new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} | ${level.padStart(15)} | ${message}`;
        })),
    }),
];
if (fileTransport)
    transports.push(fileTransport);
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(winston.format.timestamp({
        format: () => moment.utc().format('YYYY-MM-DD HH:mm:ss [UTC]'),
    }), winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} | ${level.padStart(8)} | ${message}`;
    })),
    transports,
});
export default logger;
