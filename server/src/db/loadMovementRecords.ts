// Helper file to load raw movement rows from SQLite and convert the epoch timestamps -> ISO8601
import { movement as PrismaMovementRecord } from '.prisma/client';
import settingsDB from './settings.js';
import moment from 'moment-timezone';

import { MovementRecord } from './prismaDbTypes.js';

export const loadMovementRecords = async (movementRecords: PrismaMovementRecord[]): Promise<MovementRecord[]> => {
  await settingsDB.read();
  const userTimeZone: string = settingsDB.data.timeZone || 'UTC';

  // Parse JSON fields
  return movementRecords.map((record: any) => ({
    ...record,
    timestamp: moment.tz(record.timestamp * 1000, userTimeZone).format(),
  })) as MovementRecord[];
};
