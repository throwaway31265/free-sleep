// Helper file to load raw vitals records from SQLite and convert the epoch timestamps -> ISO8601
import type { vitals as PrismaVitalRecord } from '.prisma/client';
import moment from 'moment-timezone';
import type { VitalRecord } from './prismaDbTypes.js';
import settingsDB from './settings.js';

export const loadVitals = async (
  vitalRecords: PrismaVitalRecord[],
): Promise<VitalRecord[]> => {
  await settingsDB.read();
  const userTimeZone: string = settingsDB.data.timeZone || 'UTC';

  return vitalRecords.map((vital) => ({
    ...vital,
    timestamp: moment.tz(vital.timestamp * 1000, userTimeZone).format(),
  })) as VitalRecord[];
};
