import { PrismaClient } from '@prisma/client';
import logger from '../logger.js';

let prisma: PrismaClient;

// Initialize Prisma client - reuse existing if available
try {
  const { default: existingPrisma } = await import('./prisma.js');
  prisma = existingPrisma;
} catch {
  prisma = new PrismaClient();
}

export interface WaterLevelReading {
  timestamp: number;
  rawLevel: number;
  calibratedEmpty?: number;
  calibratedFull?: number;
  isPriming?: boolean;
}

export interface LeakAlert {
  timestamp: number;
  alertType: 'slow_leak' | 'fast_leak' | 'sensor_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  rawLevelStart: number;
  rawLevelEnd: number;
  hoursTracked: number;
  rateOfChange: number;
}

/**
 * Store a water level reading in the database
 */
export async function storeWaterLevelReading(reading: WaterLevelReading): Promise<void> {
  try {
    await prisma.water_level_readings.create({
      data: {
        timestamp: reading.timestamp,
        raw_level: reading.rawLevel,
        calibrated_empty: reading.calibratedEmpty ?? 0,
        calibrated_full: reading.calibratedFull ?? 1,
        is_priming: reading.isPriming ?? false,
      },
    });

    logger.debug(`Stored water level reading: raw=${reading.rawLevel}, timestamp=${reading.timestamp}`);
  } catch (error) {
    logger.error(`Failed to store water level reading: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get recent water level readings (last N hours)
 */
export async function getRecentWaterLevelReadings(hoursBack: number = 24): Promise<WaterLevelReading[]> {
  const cutoffTime = Math.floor(Date.now() / 1000) - (hoursBack * 3600);

  try {
    const readings = await prisma.water_level_readings.findMany({
      where: {
        timestamp: {
          gte: cutoffTime,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    return readings.map(reading => ({
      timestamp: reading.timestamp,
      rawLevel: reading.raw_level,
      calibratedEmpty: reading.calibrated_empty,
      calibratedFull: reading.calibrated_full,
      isPriming: reading.is_priming,
    }));
  } catch (error) {
    logger.error(`Failed to get recent water level readings: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Store a leak alert in the database
 */
export async function storeLeakAlert(alert: LeakAlert): Promise<void> {
  try {
    await prisma.leak_alerts.create({
      data: {
        timestamp: alert.timestamp,
        alert_type: alert.alertType,
        severity: alert.severity,
        raw_level_start: alert.rawLevelStart,
        raw_level_end: alert.rawLevelEnd,
        hours_tracked: alert.hoursTracked,
        rate_of_change: alert.rateOfChange,
      },
    });

    logger.warn(`Leak alert stored: ${alert.alertType} (${alert.severity}) - Rate: ${alert.rateOfChange}/hour`);
  } catch (error) {
    logger.error(`Failed to store leak alert: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get active (non-dismissed) leak alerts
 */
export async function getActiveLeakAlerts(): Promise<LeakAlert[]> {
  try {
    const alerts = await prisma.leak_alerts.findMany({
      where: {
        dismissed_at: null,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return alerts.map(alert => ({
      timestamp: alert.timestamp,
      alertType: alert.alert_type as 'slow_leak' | 'fast_leak' | 'sensor_anomaly',
      severity: alert.severity as 'low' | 'medium' | 'high' | 'critical',
      rawLevelStart: alert.raw_level_start,
      rawLevelEnd: alert.raw_level_end,
      hoursTracked: alert.hours_tracked,
      rateOfChange: alert.rate_of_change,
    }));
  } catch (error) {
    logger.error(`Failed to get active leak alerts: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Dismiss a leak alert by timestamp
 */
export async function dismissLeakAlert(timestamp: number): Promise<void> {
  try {
    await prisma.leak_alerts.updateMany({
      where: {
        timestamp,
        dismissed_at: null,
      },
      data: {
        dismissed_at: new Date(),
      },
    });

    logger.info(`Dismissed leak alert with timestamp ${timestamp}`);
  } catch (error) {
    logger.error(`Failed to dismiss leak alert: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Clean up old water level readings (keep last 30 days)
 */
export async function cleanupOldReadings(): Promise<void> {
  const cutoffTime = Math.floor(Date.now() / 1000) - (30 * 24 * 3600); // 30 days ago

  try {
    const result = await prisma.water_level_readings.deleteMany({
      where: {
        timestamp: {
          lt: cutoffTime,
        },
      },
    });

    if (result.count > 0) {
      logger.info(`Cleaned up ${result.count} old water level readings`);
    }
  } catch (error) {
    logger.error(`Failed to cleanup old readings: ${error instanceof Error ? error.message : String(error)}`);
  }
}
