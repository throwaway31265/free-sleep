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