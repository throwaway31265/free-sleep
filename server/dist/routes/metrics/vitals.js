import express from 'express';
import { PrismaClient } from '@prisma/client'; // Import the type
import moment from 'moment-timezone';
import settingsDB from '../../db/settings.js';
import { loadVitals } from '../../db/loadVitals.js';
const prisma = new PrismaClient();
const router = express.Router();
router.get('/vitals', async (req, res) => {
    try {
        const { side, startTime, endTime } = req.query;
        // const query: { side?: string; period_start?: any } = {};
        const query = { period_start: {} }; // Use Prisma-generated type
        if (side)
            query.side = side;
        // @ts-ignore
        if (startTime)
            query.period_start = { ...query.period_start, gte: moment(startTime).unix() };
        // @ts-ignore
        if (endTime)
            query.period_start = { ...query.period_start, lte: moment(endTime).unix() };
        // Use Prisma's generated type for the records
        const vitals = await prisma.vitals.findMany({
            where: query,
            orderBy: { period_start: 'asc' },
        });
        await settingsDB.read();
        const formattedVitals = await loadVitals(vitals);
        res.json(formattedVitals);
    }
    catch (error) {
        console.error('Error fetching vitals:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
export default router;
