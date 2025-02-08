import express, { Request, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import moment from 'moment-timezone';
import { loadSleepRecords } from '../../db/loadSleepRecords.js';
const prisma = new PrismaClient();

const router = express.Router();

// Define query params
interface SleepQuery {
  side?: string;
  startTime?: string;
  endTime?: string;
}


router.get('/sleep', async (req: Request<object, object, object, SleepQuery>, res: Response) => {
  try {
    const { startTime, endTime, side } = req.query;
    const query: Prisma.sleep_recordsWhereInput = {
      entered_bed_at: {},
      left_bed_at: {},
    };

    if (side) query.side = side;
    if (startTime) { // @ts-ignore
      query.left_bed_at!.gte = moment(startTime).unix();
    }
    if (endTime) { // @ts-ignore
      query.entered_bed_at!.lte = moment(endTime).unix();
    }

    const sleepRecords = await prisma.sleep_records.findMany({
      where: query,
      orderBy: { entered_bed_at: "asc" },
    });

    const formattedRecords = await loadSleepRecords(sleepRecords);
    res.json(formattedRecords);
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
