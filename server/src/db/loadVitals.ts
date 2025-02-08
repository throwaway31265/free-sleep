import { vitals as PrismaVitalRecord } from '.prisma/client';
import settingsDB from './settings.js';
import moment from 'moment-timezone';

import { VitalRecord } from './prismaDbTypes.js';

export const loadVitals = async (vitalRecords: PrismaVitalRecord[]): Promise<VitalRecord[]> => {
  await settingsDB.read();
  const userTimeZone: string = settingsDB.data.timeZone || 'UTC';

  return vitalRecords.map((vital) => ({
    ...vital,
    period_start: moment.tz(vital.period_start * 1000, userTimeZone).format(),
  })) as VitalRecord[];
}
