import express, { Request, Response } from 'express';
import logger from '../../logger.js';
import { PrismaClient } from '@prisma/client';
import moment from 'moment-timezone';
import { SleepRecord } from '../../db/sleepRecordsSchema';
const prisma = new PrismaClient();
const router = express.Router();
// /home/dac/bio/src/presence_detection/analyze_sleep.py --side=left --start_time=2025-02-06T02:15:00.121Z --end_time=2025-02-06T17:15:00.124Z

router.get('/sleep', async (req: Request, res: Response) => {
  try {
    const { startTime, endTime, side } = req.query;
    // Build the raw SQL query dynamically
    let sql = `SELECT * FROM sleep_records WHERE 1=1`;
    const params: any[] = [];

    if (side) {
      sql += ` AND side = $${params.length + 1}`;
      params.push(side);
    }
    if (startTime) {
      sql += ` AND entered_bed_at >= datetime($${params.length + 1})`;
      params.push(startTime);
    }
    if (endTime) {
      sql += ` AND entered_bed_at <= datetime($${params.length + 1})`;
      params.push(endTime);
    }

    sql += ` ORDER BY entered_bed_at ASC`;

    // Execute the raw SQL query using Prisma
    const sleepRecords = await prisma.$queryRawUnsafe(sql, ...params) as SleepRecord[];


    // Parse JSON fields
    const parsedRecords = sleepRecords.map((record: any) => ({
      ...record,
      present_intervals: record.present_intervals
        ? JSON.parse(record.present_intervals)
        : [],
      not_present_intervals: record.not_present_intervals
        ? JSON.parse(record.not_present_intervals)
        : [],
    }));

    res.json(parsedRecords);
  } catch (error) {
    console.error('Error in GET /sleep:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.delete('/sleep/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.sleep_records.delete({ where: { id: parseInt(id, 10) } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting record:', error);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});


export default router;
