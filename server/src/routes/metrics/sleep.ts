import type { Prisma } from '@prisma/client';
import express, { type Request, type Response } from 'express';
import moment from 'moment-timezone';
import { loadSleepRecords } from '../../db/loadSleepRecords.js';
import prisma from '../../db/prisma.js';
import {
  type SleepRecord,
  sleepRecordSchema,
} from '../../db/sleepRecordsSchema.js';

const router = express.Router();

// Define query params
interface SleepQuery {
  side?: string;
  startTime?: string;
  endTime?: string;
}

router.get(
  '/sleep',
  async (req: Request<object, object, object, SleepQuery>, res: Response) => {
    try {
      const { startTime, endTime, side } = req.query;
      const query: Prisma.sleep_recordsWhereInput = {
        entered_bed_at: {},
        left_bed_at: {},
      };

      if (side) query.side = side;
      if (startTime) {
        query.left_bed_at = {
          gte: moment(startTime).unix(),
        };
      }
      if (endTime) {
        query.entered_bed_at = {
          lte: moment(endTime).unix(),
        };
      }

      const sleepRecords = await prisma.sleep_records.findMany({
        where: query,
        orderBy: { entered_bed_at: 'asc' },
      });

      const formattedRecords = await loadSleepRecords(sleepRecords);
      res.json(formattedRecords);
    } catch (error) {
      console.error('Error in GET /sleep:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// @ts-ignore
router.put<{ id: string }, any, SleepRecord>('/sleep/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    // Fetch the existing record
    let existingRecord = await prisma.sleep_records.findUnique({
      where: { id: parsedId },
    });
    if (!existingRecord) {
      return res.status(404).json({ error: 'Sleep record not found' });
    }
    const loadedRecords = await loadSleepRecords([existingRecord]);
    // @ts-ignore
    existingRecord = loadedRecords[0];

    // Validate the request body
    const parsedData = sleepRecordSchema.partial().safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: parsedData.error.format(),
      });
    }
    // Convert entered_bed_at and exited_bed_at to epoch timestamps
    const updatedRecord = { ...parsedData.data };
    let enteredBedTimestamp: number | undefined;
    let leftBedTimestamp: number | undefined;

    if (updatedRecord.entered_bed_at) {
      enteredBedTimestamp = Math.floor(
        new Date(updatedRecord.entered_bed_at).getTime() / 1000,
      );
      // @ts-ignore
      updatedRecord.entered_bed_at = enteredBedTimestamp;
    }
    if (updatedRecord.left_bed_at) {
      leftBedTimestamp = Math.floor(
        new Date(updatedRecord.left_bed_at).getTime() / 1000,
      );
      // @ts-ignore
      updatedRecord.left_bed_at = leftBedTimestamp;
    }

    // Need to recalculate the number of times someone left the bed during the new sleep interval
    if (enteredBedTimestamp && leftBedTimestamp) {
      // @ts-ignore
      updatedRecord.sleep_period_seconds =
        leftBedTimestamp - enteredBedTimestamp;

      // @ts-ignore
      updatedRecord.times_exited_bed =
        (existingRecord?.not_present_intervals as unknown as any[])?.filter(
          ([start, end]: [string, string]) => {
            const startTime = Math.floor(new Date(start).getTime() / 1000);
            const endTime = Math.floor(new Date(end).getTime() / 1000);
            return (
              startTime >= enteredBedTimestamp && endTime <= leftBedTimestamp
            );
          },
        ).length || 0;
    }

    // Update the record in the database
    const dbUpdatedRecord = await prisma.sleep_records.update({
      where: { id: parsedId },
      // @ts-ignore
      data: updatedRecord,
    });

    // Load and return the updated record
    const loadedNewRecord = await loadSleepRecords([dbUpdatedRecord]);
    return res.json(loadedNewRecord[0]);
  } catch (error) {
    console.error('Error updating sleep record:', error);
    return res.status(500).json({ error: 'Internal server error' });
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
