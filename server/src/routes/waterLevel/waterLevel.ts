import { Request, Response } from 'express';
import { z } from 'zod';
import {
    getRecentWaterLevelReadings,
    getActiveLeakAlerts,
    dismissLeakAlert
} from '../../db/waterLevelReadings.js';
import { getLeakDetectionStatus } from '../../jobs/leakDetection.js';
import logger from '../../logger.js';

// Validation schemas
const GetReadingsQuerySchema = z.object({
  hours: z.string().regex(/^\d+$/).transform(Number).optional().default(24),
  maxPoints: z
    .preprocess((v) => (v === undefined ? 1000 : v), z.coerce.number().int().min(10).max(20000))
    .optional(),
});

const DismissAlertBodySchema = z.object({
  timestamp: z.number(),
});

/**
 * GET /api/water-level/readings
 * Get recent water level readings
 */
export async function getWaterLevelReadings(req: Request, res: Response): Promise<void> {
  try {
    const { hours, maxPoints = 1000 } = GetReadingsQuerySchema.parse(req.query);

    const readings = await getRecentWaterLevelReadings(hours);

    // Downsample uniformly if too many points to avoid UI lag
    let sampled = readings;
    if (sampled.length > maxPoints) {
      const step = Math.ceil(sampled.length / maxPoints);
      const downsampled: typeof sampled = [];
      for (let i = 0; i < sampled.length; i += step) {
        downsampled.push(sampled[i]);
      }
      // Ensure the last point is included
      if (downsampled[downsampled.length - 1]?.timestamp !== sampled[sampled.length - 1]?.timestamp) {
        downsampled.push(sampled[sampled.length - 1]);
      }
      sampled = downsampled;
    }

    res.json({
      success: true,
      data: {
        readings: sampled,
        hoursRequested: hours,
        count: sampled.length,
      },
    });
  } catch (error) {
    logger.error(`Error getting water level readings: ${error instanceof Error ? error.message : String(error)}`);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: error.issues,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to get water level readings',
    });
  }
}

/**
 * GET /api/water-level/alerts
 * Get active leak alerts
 */
export async function getLeakAlerts(req: Request, res: Response): Promise<void> {
  try {
    const alerts = await getActiveLeakAlerts();

    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
      },
    });
  } catch (error) {
    logger.error(`Error getting leak alerts: ${error instanceof Error ? error.message : String(error)}`);

    res.status(500).json({
      success: false,
      error: 'Failed to get leak alerts',
    });
  }
}

/**
 * POST /api/water-level/alerts/dismiss
 * Dismiss a leak alert
 */
export async function dismissAlert(req: Request, res: Response): Promise<void> {
  try {
    const { timestamp } = DismissAlertBodySchema.parse(req.body);

    await dismissLeakAlert(timestamp);

    res.json({
      success: true,
      data: {
        message: 'Alert dismissed successfully',
      },
    });
  } catch (error) {
    logger.error(`Error dismissing leak alert: ${error instanceof Error ? error.message : String(error)}`);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        data: null,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to dismiss alert',
      data: null,
    });
  }
}

/**
 * GET /api/water-level/status
 * Get leak detection system status
 */
export async function getLeakDetectionSystemStatus(req: Request, res: Response): Promise<void> {
  try {
    const status = await getLeakDetectionStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error(`Error getting leak detection status: ${error instanceof Error ? error.message : String(error)}`);

    res.status(500).json({
      success: false,
      error: 'Failed to get leak detection status',
    });
  }
}

/**
 * Calculate water level percentage from calibrated values
 */
function calculateWaterPercentage(rawLevel: number, calibratedEmpty: number, calibratedFull: number): number {
  const range = calibratedFull - calibratedEmpty;
  const levelAboveEmpty = rawLevel - calibratedEmpty;
  const percentage = (levelAboveEmpty / range) * 100;

  // Clamp to 0-100% range
  return Math.max(0, Math.min(100, percentage));
}

/**
 * GET /api/water-level/summary
 * Get a summary of water level data and alerts
 */
export async function getWaterLevelSummary(req: Request, res: Response): Promise<void> {
  try {
    const [recentReadings, alerts, status] = await Promise.all([
      getRecentWaterLevelReadings(6), // Last 6 hours
      getActiveLeakAlerts(),
      getLeakDetectionStatus(),
    ]);

    // Calculate basic statistics
    const latestReading = recentReadings[recentReadings.length - 1];
    const oldestReading = recentReadings[0];

    let trend = 'stable';
    let changeRate = 0;
    let currentLevelPercentage: number | undefined;

    if (latestReading) {
      // Calculate percentage using calibration values
      if (latestReading.calibratedEmpty !== undefined && latestReading.calibratedFull !== undefined) {
        currentLevelPercentage = calculateWaterPercentage(
          latestReading.rawLevel,
          latestReading.calibratedEmpty,
          latestReading.calibratedFull
        );
      }

      if (oldestReading && recentReadings.length > 1) {
        const hoursSpan = (latestReading.timestamp - oldestReading.timestamp) / 3600;
        changeRate = (latestReading.rawLevel - oldestReading.rawLevel) / hoursSpan;

        // Adjusted thresholds based on capwater sensor behavior
        if (changeRate < -0.003) {
          trend = 'declining';
        } else if (changeRate > 0.003) {
          trend = 'rising';
        }
      }
    }

    res.json({
      success: true,
      data: {
        currentLevel: currentLevelPercentage,
        rawLevel: latestReading?.rawLevel,
        lastUpdated: latestReading?.timestamp,
        trend,
        changeRate,
        activeAlerts: alerts.length,
        highestSeverityAlert: alerts.length > 0
          ? alerts.reduce((max, alert) => {
              const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
              return severityOrder[alert.severity] > severityOrder[max.severity] ? alert : max;
            }).severity
          : null,
        isMonitoring: status.isActive,
        readingsCount: recentReadings.length,
        calibration: latestReading ? {
          empty: latestReading.calibratedEmpty,
          full: latestReading.calibratedFull,
          range: latestReading.calibratedFull && latestReading.calibratedEmpty
            ? latestReading.calibratedFull - latestReading.calibratedEmpty
            : undefined,
        } : undefined,
      },
    });
  } catch (error) {
    logger.error(`Error getting water level summary: ${error instanceof Error ? error.message : String(error)}`);

    res.status(500).json({
      success: false,
      error: 'Failed to get water level summary',
    });
  }
}
