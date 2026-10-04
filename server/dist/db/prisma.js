
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="86fb3f98-0460-5f2d-b6c4-671bdb27b80a")}catch(e){}}();
import { PrismaClient } from '@prisma/client';
import logger from '../logger.js';
export const prisma = new PrismaClient({
    errorFormat: 'pretty',
    log: ['error', 'warn'],
});
prisma.$on('error', (event) => {
    logger.error({
        message: event.message,
        target: event.target,
    });
});
prisma.$on('warn', (event) => {
    logger.warn({
        message: event.message,
        target: event.target,
    });
});
//# sourceMappingURL=prisma.js.map
//# debugId=86fb3f98-0460-5f2d-b6c4-671bdb27b80a
