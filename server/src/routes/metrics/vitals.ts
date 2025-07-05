import express, { Request, Response } from 'express';
import { Prisma, vitals as VitalRecord } from '@prisma/client'; // Import the type
import moment from 'moment-timezone';
import settingsDB from '../../db/settings.js';
import { loadVitals } from '../../db/loadVitals.js';
import prisma from '../../db/prisma.js';

const router = express.Router();

// Define query params
interface VitalsQuery {
  side?: string;
  startTime?: string;
  endTime?: string;
}

router.get(
  '/vitals',
  async (req: Request<object, object, object, VitalsQuery>, res: Response) => {
    try {
      const { side, startTime, endTime } = req.query;

      const query: Prisma.vitalsWhereInput = {};

      if (side) query.side = side;

      query.timestamp = {};
      if (startTime) query.timestamp.gte = moment(startTime).unix();
      if (endTime) query.timestamp.lte = moment(endTime).unix();

      // Use Prisma's generated type for the records
      const vitals: VitalRecord[] = await prisma.vitals.findMany({
        where: query,
        orderBy: { timestamp: 'asc' },
      });

      await settingsDB.read();

      const formattedVitals = await loadVitals(vitals);

      res.json(formattedVitals);
    } catch (error) {
      console.error('Error fetching vitals:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  },
);

router.get(
  '/vitals/summary',
  async (req: Request<object, object, object, VitalsQuery>, res: Response) => {
    try {
      const { side, startTime, endTime } = req.query;

      const query: Prisma.vitalsWhereInput = {};

      if (side) query.side = side;

      query.timestamp = {};
      if (startTime) query.timestamp.gte = moment(startTime).unix();
      if (endTime) query.timestamp.lte = moment(endTime).unix();

      // Query: Min & Max Heart Rate
      const heartRateSummary = await prisma.vitals.aggregate({
        where: query,
        _min: { heart_rate: true },
        _max: { heart_rate: true },
        _avg: { heart_rate: true },
      });

      // Query: Average Breathing Rate (excluding 0)
      const avgBreathingRate = await prisma.vitals.aggregate({
        where: {
          ...query,
          breathing_rate: { not: 0, lte: 20, gte: 5 }, // Exclude zero values
        },
        _avg: { breathing_rate: true },
      });

      // Query: Average HRV (excluding 0)
      const avgHRV = await prisma.vitals.aggregate({
        where: {
          ...query,
          hrv: { not: 0, lte: 120, gte: 30 }, // Exclude zero values
        },
        _avg: { hrv: true },
      });

      res.json({
        avgHeartRate: Math.round(heartRateSummary._avg.heart_rate || 0),
        minHeartRate: Math.round(heartRateSummary._min.heart_rate || 0),
        maxHeartRate: Math.round(heartRateSummary._max.heart_rate || 0),
        avgHRV: Math.round(avgHRV._avg.hrv || 0),
        avgBreathingRate: Math.round(avgBreathingRate._avg.breathing_rate || 0),
      });
    } catch (error) {
      console.error('Error fetching vitals summary:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  },
);

export default router;
