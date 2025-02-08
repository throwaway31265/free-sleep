import express from 'express';
import logger from '../../logger.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const router = express.Router();
router.get('/sleep', async (req, res) => {
    try {
        // Extract query parameters
        const { start_time, end_time, side } = req.query;
        // Build dynamic where clause based on provided filters
        const whereClause = {};
        if (start_time) {
            whereClause.entered_bed_at = {
                gte: new Date(start_time),
            };
        }
        if (end_time) {
            whereClause.left_bed_at = {
                lte: new Date(end_time),
            };
        }
        if (side) {
            whereClause.side = side;
        }
        // Fetch records from the database with optional filters
        const sleepRecords = await prisma.sleep_records.findMany({
            where: whereClause,
        });
        // Parse JSON fields for present_intervals and not_present_intervals
        const parsedRecords = sleepRecords.map((record) => ({
            ...record,
            present_intervals: JSON.parse(record.present_intervals),
            not_present_intervals: JSON.parse(record.not_present_intervals),
        }));
        res.json(parsedRecords);
    }
    catch (error) {
        logger.error('Failed to fetch sleep records:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
export default router;
