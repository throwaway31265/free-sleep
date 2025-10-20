import type { Prisma, ambient_light_readings as AmbientLightReading } from '@prisma/client';
import express, { type Request, type Response } from 'express';
import moment from 'moment-timezone';
import prisma from '../../db/prisma.js';

const router = express.Router();

// Define query params
interface AmbientLightQuery {
  startTime?: string;
  endTime?: string;
  limit?: string;
}

router.get(
  '/ambient-light',
  async (req: Request<object, object, object, AmbientLightQuery>, res: Response) => {
    try {
      const { startTime, endTime, limit } = req.query;

      const query: Prisma.ambient_light_readingsWhereInput = {};

      query.timestamp = {};
      if (startTime) query.timestamp.gte = moment(startTime).unix();
      if (endTime) query.timestamp.lte = moment(endTime).unix();

      const readings: AmbientLightReading[] = await prisma.ambient_light_readings.findMany({
        where: query,
        orderBy: { timestamp: 'asc' },
        take: limit ? parseInt(limit, 10) : undefined,
      });

      // Format the response to include ISO timestamps
      const formattedReadings = readings.map((reading) => ({
        ...reading,
        datetime: moment.unix(reading.timestamp).toISOString(),
      }));

      res.json(formattedReadings);
    } catch (error) {
      console.error('Error fetching ambient light readings:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  },
);

router.get(
  '/ambient-light/summary',
  async (req: Request<object, object, object, AmbientLightQuery>, res: Response) => {
    try {
      const { startTime, endTime } = req.query;

      const query: Prisma.ambient_light_readingsWhereInput = {};

      query.timestamp = {};
      if (startTime) query.timestamp.gte = moment(startTime).unix();
      if (endTime) query.timestamp.lte = moment(endTime).unix();

      // Query: Min, Max, and Average lux
      const luxSummary = await prisma.ambient_light_readings.aggregate({
        where: query,
        _min: { lux: true },
        _max: { lux: true },
        _avg: { lux: true },
      });

      // Get total count of readings
      const count = await prisma.ambient_light_readings.count({
        where: query,
      });

      res.json({
        avgLux: Math.round((luxSummary._avg.lux || 0) * 100) / 100, // Round to 2 decimals
        minLux: Math.round((luxSummary._min.lux || 0) * 100) / 100,
        maxLux: Math.round((luxSummary._max.lux || 0) * 100) / 100,
        count,
      });
    } catch (error) {
      console.error('Error fetching ambient light summary:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  },
);

router.get(
  '/ambient-light/latest',
  async (_req: Request, res: Response) => {
    try {
      const latestReading = await prisma.ambient_light_readings.findFirst({
        orderBy: { timestamp: 'desc' },
      });

      if (!latestReading) {
        res.status(404).json({ error: 'No ambient light readings found' });
        return;
      }

      const formattedReading = {
        ...latestReading,
        datetime: moment.unix(latestReading.timestamp).toISOString(),
      };

      res.json(formattedReading);
    } catch (error) {
      console.error('Error fetching latest ambient light reading:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  },
);

export default router;
