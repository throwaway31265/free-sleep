import axiosInstance from '@api/api';
import { z } from 'zod';

// API response schemas
const WaterLevelReadingSchema = z.object({
  timestamp: z.number(),
  rawLevel: z.number(),
  calibratedEmpty: z.number().optional(),
  calibratedFull: z.number().optional(),
  isPriming: z.boolean().optional(),
});

const LeakAlertSchema = z.object({
  timestamp: z.number(),
  alertType: z.enum(['slow_leak', 'fast_leak', 'sensor_anomaly']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  rawLevelStart: z.number(),
  rawLevelEnd: z.number(),
  hoursTracked: z.number(),
  rateOfChange: z.number(),
});

const LeakDetectionStatusSchema = z.object({
  isActive: z.boolean(),
  lastAnalysis: z.string(),
  recentTrend: z.object({
    rateOfChange: z.number(),
    hoursTracked: z.number(),
    confidence: z.number(),
  }),
  readingsCount: z.number(),
});

const WaterLevelSummarySchema = z.object({
  currentLevel: z.number().optional(),
  rawLevel: z.number().optional(),
  lastUpdated: z.number().optional(),
  trend: z.enum(['stable', 'declining', 'rising']),
  changeRate: z.number(),
  activeAlerts: z.number(),
  highestSeverityAlert: z
    .enum(['low', 'medium', 'high', 'critical'])
    .nullable(),
  isMonitoring: z.boolean(),
  readingsCount: z.number(),
  calibration: z
    .object({
      empty: z.number().optional(),
      full: z.number().optional(),
      range: z.number().optional(),
    })
    .optional(),
});

// API response wrappers
const APIResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema,
    error: z.string().optional(),
  });

export type WaterLevelReading = z.infer<typeof WaterLevelReadingSchema>;
export type LeakAlert = z.infer<typeof LeakAlertSchema>;
export type LeakDetectionStatus = z.infer<typeof LeakDetectionStatusSchema>;
export type WaterLevelSummary = z.infer<typeof WaterLevelSummarySchema>;

/**
 * Get recent water level readings
 */
export async function getWaterLevelReadings(
  hours = 24,
): Promise<WaterLevelReading[]> {
  const { data } = await axiosInstance.get('water-level/readings', {
    params: { hours },
  });

  const result = APIResponseSchema(
    z.object({
      readings: z.array(WaterLevelReadingSchema),
      hoursRequested: z.number(),
      count: z.number(),
    }),
  ).parse(data);

  if (!result.success) {
    throw new Error(result.error || 'Failed to get water level readings');
  }

  return result.data.readings;
}

/**
 * Get active leak alerts
 */
export async function getLeakAlerts(): Promise<LeakAlert[]> {
  const { data } = await axiosInstance.get('water-level/alerts');

  const result = APIResponseSchema(
    z.object({
      alerts: z.array(LeakAlertSchema),
      count: z.number(),
    }),
  ).parse(data);

  if (!result.success) {
    throw new Error(result.error || 'Failed to get leak alerts');
  }

  return result.data.alerts;
}

/**
 * Dismiss a leak alert
 */
export async function dismissLeakAlert(timestamp: number): Promise<void> {
  const { data } = await axiosInstance.post('water-level/alerts/dismiss', {
    timestamp,
  });

  const result = APIResponseSchema(
    z.object({
      message: z.string(),
    }),
  ).parse(data);

  if (!result.success) {
    throw new Error(result.error || 'Failed to dismiss leak alert');
  }
}

/**
 * Get leak detection system status
 */
export async function getLeakDetectionStatus(): Promise<LeakDetectionStatus> {
  const { data } = await axiosInstance.get('water-level/status');

  const result = APIResponseSchema(LeakDetectionStatusSchema).parse(data);

  if (!result.success) {
    throw new Error(result.error || 'Failed to get leak detection status');
  }

  return result.data;
}

/**
 * Get water level summary
 */
export async function getWaterLevelSummary(): Promise<WaterLevelSummary> {
  const { data } = await axiosInstance.get('water-level/summary');

  const result = APIResponseSchema(WaterLevelSummarySchema).parse(data);

  if (!result.success) {
    throw new Error(result.error || 'Failed to get water level summary');
  }

  return result.data;
}
