import express from 'express';
import cors from 'cors';
import logger from '../logger.js';
import os from 'os';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const interfaceName in interfaces) {
        const networkInterface = interfaces[interfaceName];
        if (!networkInterface)
            continue;
        for (const network of networkInterface) {
            if (network.family === 'IPv4' && !network.internal) {
                return network.address;
            }
        }
    }
    return 'localhost'; // Default to localhost if LAN IP isn't found
}
/**
 * Check if the request origin is allowed, i.e., from localhost or LAN IP, or
 * matches the `ALLOWED_ORIGIN` environment variable. The function also allows
 * requests with no origin (e.g., `curl`).
 *
 * If `ALLOWED_ORIGIN` is set to a wildcard (`*`), all origins are allowed.
 *
 * @param origin - The origin to check.
 * @returns True if the origin is allowed, false otherwise.
 */
function isAllowedOrigin(origin) {
    if (!origin) {
        return true;
    }
    if (ALLOWED_ORIGIN === '*') {
        return true;
    }
    if (origin.startsWith(`http://${getLocalIp()}:`) ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://192.168.') ||
        origin.startsWith('http://172.16.') ||
        origin.startsWith('http://10.0.') ||
        (ALLOWED_ORIGIN && origin.startsWith(ALLOWED_ORIGIN))) {
        return true;
    }
    return false;
}
export default function (app) {
    app.use((req, res, next) => {
        const startTime = Date.now();
        // Hook into the response `finish` event to log after the response is sent
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
        });
        next();
    });
    app.use(express.json());
    // Allow local development
    app.use(cors({
        origin: (origin, callback) => {
            if (isAllowedOrigin(origin)) {
                return callback(null, true);
            }
            return callback(new Error('Not allowed by CORS'));
        }
    }));
    // Logging
    app.use((req, res, next) => {
        const clientIp = req.headers['x-forwarded-for'] || req.ip;
        const method = req.method;
        const endpoint = req.originalUrl;
        logger.debug(`${method} ${endpoint} - IP: ${clientIp}`);
        next();
    });
}
//# sourceMappingURL=middleware.js.map