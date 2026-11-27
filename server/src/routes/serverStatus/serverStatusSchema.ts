// WARNING! - Any changes here MUST be the same between app/src/api & server/src/db/
import { z } from 'zod';


const StatusSchema = z.enum([
  'failed',
  'healthy',
  'not_started',
  'restarting',
  'retrying',
  'started',
]);

export type Status = z.infer<typeof StatusSchema>;

export const StatusInfoSchema = z.object({
  name: z.string(),
  status: StatusSchema,
  description: z.string(),
  message: z.string(),
  timestamp: z.string().optional(),
});

export type StatusInfo = z.infer<typeof StatusInfoSchema>;

export type ServerStatus = {
  alarmSchedule: StatusInfo;
  autopilot: StatusInfo;
  database: StatusInfo;
  environment: StatusInfo;
  express: StatusInfo;
  franken: StatusInfo;
  frankenMonitor: StatusInfo;
  jobs: StatusInfo;
  logger: StatusInfo;
  powerSchedule: StatusInfo;
  primeSchedule: StatusInfo;
  rebootSchedule: StatusInfo;
  systemDate: StatusInfo;
  temperatureSchedule: StatusInfo;
  analyzeSleepLeft?: StatusInfo;
  analyzeSleepRight?: StatusInfo;
  biometricsInstallation?: StatusInfo;
  biometricsStream?: StatusInfo;
  biometricsCalibrationLeft?: StatusInfo;
  biometricsCalibrationRight?: StatusInfo;
};

// eslint-disable-next-line @typescript-eslint/no-type-alias
export type ServerStatusKey = keyof ServerStatus;
