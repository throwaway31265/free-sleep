import {
  getRecentWaterLevelReadings,
  storeLeakAlert,
  type WaterLevelReading,
  type LeakAlert
} from '../db/waterLevelReadings.js';
import logger from '../logger.js';

/**
 * Configuration for leak detection thresholds
 */
interface LeakDetectionConfig {
  // Minimum time window to analyze (hours)
  minAnalysisWindow: number;

  // Thresholds for different types of leaks (change per hour in raw units)
  slowLeakThreshold: number;     // e.g., -0.005 per hour
  fastLeakThreshold: number;     // e.g., -0.02 per hour
  criticalLeakThreshold: number; // e.g., -0.05 per hour

  // Minimum number of readings required for analysis
  minReadings: number;

  // Ignore changes during priming
  ignorePrimingPeriod: boolean;

  // Time to wait after priming before resuming leak detection (hours)
  primingCooldownHours: number;
}

const DEFAULT_CONFIG: LeakDetectionConfig = {
  minAnalysisWindow: 2,           // Analyze last 2 hours minimum
  slowLeakThreshold: -0.008,      // Small, gradual leak (adjusted for 0.29 unit range)
  fastLeakThreshold: -0.015,      // Noticeable leak (adjusted for sensor sensitivity)
  criticalLeakThreshold: -0.030,  // Major leak requiring immediate attention
  minReadings: 3,                 // Need at least 3 readings (30min intervals = 1.5hrs minimum)
  ignorePrimingPeriod: true,
  primingCooldownHours: 2,        // Wait 2 hours after priming (Pod 4 specific)
};

/**
 * Analyze water level trend over a time period
 */
function analyzeTrend(readings: WaterLevelReading[]): {
  rateOfChange: number;
  hoursTracked: number;
  confidence: number;
} {
  if (readings.length < 2) {
    return { rateOfChange: 0, hoursTracked: 0, confidence: 0 };
  }

  // Filter out readings during priming if configured
  const filteredReadings = DEFAULT_CONFIG.ignorePrimingPeriod
    ? readings.filter(r => !r.isPriming)
    : readings;

  if (filteredReadings.length < 2) {
    return { rateOfChange: 0, hoursTracked: 0, confidence: 0 };
  }

  // Sort by timestamp
  const sortedReadings = [...filteredReadings].sort((a, b) => a.timestamp - b.timestamp);

  // Calculate linear regression to get rate of change
  const n = sortedReadings.length;
  const firstTime = sortedReadings[0].timestamp;

  // Convert timestamps to hours from start
  const timePoints = sortedReadings.map(r => (r.timestamp - firstTime) / 3600);
  const levelPoints = sortedReadings.map(r => r.rawLevel);

  // Linear regression: y = mx + b, we want m (slope)
  const sumX = timePoints.reduce((sum, x) => sum + x, 0);
  const sumY = levelPoints.reduce((sum, y) => sum + y, 0);
  const sumXY = timePoints.reduce((sum, x, i) => sum + x * levelPoints[i], 0);
  const sumX2 = timePoints.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Calculate correlation coefficient for confidence
  const meanX = sumX / n;
  const meanY = sumY / n;

  const numerator = timePoints.reduce((sum, x, i) => sum + (x - meanX) * (levelPoints[i] - meanY), 0);
  const denomX = Math.sqrt(timePoints.reduce((sum, x) => sum + (x - meanX) ** 2, 0));
  const denomY = Math.sqrt(levelPoints.reduce((sum, y) => sum + (y - meanY) ** 2, 0));

  const correlation = Math.abs(numerator / (denomX * denomY));

  const hoursTracked = timePoints[timePoints.length - 1];

  return {
    rateOfChange: slope,
    hoursTracked,
    confidence: isNaN(correlation) ? 0 : correlation,
  };
}

/**
 * Determine leak severity based on rate of change
 */
function getLeakSeverity(rateOfChange: number): {
  alertType: LeakAlert['alertType'];
  severity: LeakAlert['severity'];
} {
  if (rateOfChange <= DEFAULT_CONFIG.criticalLeakThreshold) {
    return { alertType: 'fast_leak', severity: 'critical' };
  }

  if (rateOfChange <= DEFAULT_CONFIG.fastLeakThreshold) {
    return { alertType: 'fast_leak', severity: 'high' };
  }

  if (rateOfChange <= DEFAULT_CONFIG.slowLeakThreshold) {
    return { alertType: 'slow_leak', severity: 'medium' };
  }

  // Positive change or small negative change - no leak
  return { alertType: 'slow_leak', severity: 'low' };
}

/**
 * Check for sensor anomalies (erratic readings)
 */
function detectSensorAnomalies(readings: WaterLevelReading[]): boolean {
  if (readings.length < 3) return false;

  // Check for sudden large jumps in consecutive readings
  for (let i = 1; i < readings.length; i++) {
    const diff = Math.abs(readings[i].rawLevel - readings[i-1].rawLevel);

    // Flag if there's a sudden jump of more than 0.05 units (adjusted for capwater sensor range ~0.29)
    if (diff > 0.05) {
      return true;
    }
  }

  // Check for excessive variance (adjusted for capwater sensor behavior)
  const levels = readings.map(r => r.rawLevel);
  const mean = levels.reduce((sum, level) => sum + level, 0) / levels.length;
  const variance = levels.reduce((sum, level) => sum + (level - mean) ** 2, 0) / levels.length;
  const stdDev = Math.sqrt(variance);

  // Flag if standard deviation is unusually high (> 0.02 for capwater sensors)
  return stdDev > 0.02;
}

/**
 * Check if we're in a priming cooldown period
 */
function isInPrimingCooldown(readings: WaterLevelReading[]): boolean {
  if (!DEFAULT_CONFIG.ignorePrimingPeriod) return false;

  const now = Math.floor(Date.now() / 1000);
  const cooldownSeconds = DEFAULT_CONFIG.primingCooldownHours * 3600;

  // Find the most recent priming event
  for (const reading of readings.reverse()) {
    if (reading.isPriming) {
      const timeSincePriming = now - reading.timestamp;
      return timeSincePriming < cooldownSeconds;
    }
  }

  return false;
}

/**
 * Main leak detection function
 */
export async function detectLeaks(): Promise<void> {
  try {
    logger.debug('Starting leak detection analysis');

    // Get recent readings for analysis
    const readings = await getRecentWaterLevelReadings(24); // Last 24 hours

    if (readings.length < DEFAULT_CONFIG.minReadings) {
      logger.debug(`Insufficient readings for leak detection: ${readings.length} < ${DEFAULT_CONFIG.minReadings}`);
      return;
    }

    // Check if we're in priming cooldown
    if (isInPrimingCooldown(readings)) {
      logger.debug('In priming cooldown period, skipping leak detection');
      return;
    }

    // Check for sensor anomalies first
    if (detectSensorAnomalies(readings)) {
      const now = Math.floor(Date.now() / 1000);
      const alert: LeakAlert = {
        timestamp: now,
        alertType: 'sensor_anomaly',
        severity: 'medium',
        rawLevelStart: readings[0].rawLevel,
        rawLevelEnd: readings[readings.length - 1].rawLevel,
        hoursTracked: (readings[readings.length - 1].timestamp - readings[0].timestamp) / 3600,
        rateOfChange: 0,
      };

      await storeLeakAlert(alert);
      logger.warn('Sensor anomaly detected in water level readings');
      return;
    }

    // Analyze trend over different time windows
    const timeWindows = [2, 6, 12, 24]; // Hours

    for (const windowHours of timeWindows) {
      if (windowHours < DEFAULT_CONFIG.minAnalysisWindow) continue;

      const cutoffTime = Math.floor(Date.now() / 1000) - (windowHours * 3600);
      const windowReadings = readings.filter(r => r.timestamp >= cutoffTime);

      if (windowReadings.length < DEFAULT_CONFIG.minReadings) continue;

      const trend = analyzeTrend(windowReadings);

      // Only trigger alerts for trends with good confidence and significant change
      if (trend.confidence > 0.7 && trend.rateOfChange < DEFAULT_CONFIG.slowLeakThreshold) {
        const { alertType, severity } = getLeakSeverity(trend.rateOfChange);

        // Don't create duplicate low-severity alerts
        if (severity === 'low') continue;

        const alert: LeakAlert = {
          timestamp: Math.floor(Date.now() / 1000),
          alertType,
          severity,
          rawLevelStart: windowReadings[0].rawLevel,
          rawLevelEnd: windowReadings[windowReadings.length - 1].rawLevel,
          hoursTracked: trend.hoursTracked,
          rateOfChange: trend.rateOfChange,
        };

        await storeLeakAlert(alert);

        logger.warn(
          `Leak detected: ${alertType} (${severity}) over ${trend.hoursTracked.toFixed(1)} hours. ` +
          `Rate: ${trend.rateOfChange.toFixed(4)} units/hour, Confidence: ${(trend.confidence * 100).toFixed(1)}%`
        );

        // Only alert for the first significant detection to avoid spam
        break;
      }
    }

    logger.debug('Leak detection analysis completed');
  } catch (error) {
    logger.error(`Error in leak detection: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get leak detection status and recent trends
 */
export async function getLeakDetectionStatus(): Promise<{
  isActive: boolean;
  lastAnalysis: string;
  recentTrend: {
    rateOfChange: number;
    hoursTracked: number;
    confidence: number;
  };
  readingsCount: number;
}> {
  try {
    const readings = await getRecentWaterLevelReadings(6); // Last 6 hours
    const trend = analyzeTrend(readings);

    return {
      isActive: readings.length >= DEFAULT_CONFIG.minReadings && !isInPrimingCooldown(readings),
      lastAnalysis: new Date().toISOString(),
      recentTrend: trend,
      readingsCount: readings.length,
    };
  } catch (error) {
    logger.error(`Error getting leak detection status: ${error instanceof Error ? error.message : String(error)}`);
    return {
      isActive: false,
      lastAnalysis: new Date().toISOString(),
      recentTrend: { rateOfChange: 0, hoursTracked: 0, confidence: 0 },
      readingsCount: 0,
    };
  }
}
