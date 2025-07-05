import { useQuery } from '@tanstack/react-query';
import type { SleepRecord } from '../../../server/src/db/sleepRecordsSchema.ts';
import axios from './api';

interface SleepRecordQueryParams {
  startTime?: string; // ISO 8601 format (e.g., 2025-01-01T00:00:00Z)
  endTime?: string; // ISO 8601 format (e.g., 2025-01-31T23:59:59Z)
  side?: 'left' | 'right';
}

export const useSleepRecords = (params?: SleepRecordQueryParams) => {
  return useQuery<SleepRecord[]>({
    queryKey: ['useSleepRecords', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();

      if (params?.startTime) queryParams.append('startTime', params.startTime);
      if (params?.endTime) queryParams.append('endTime', params.endTime);
      if (params?.side) queryParams.append('side', params.side);

      const response = await axios.get<SleepRecord[]>(
        `/metrics/sleep?${queryParams.toString()}`,
      );
      return response.data;
    },
  });
};

export const deleteSleepRecord = async (id: number): Promise<void> => {
  await axios.delete(`/metrics/sleep/${id}`);
};

export const updateSleepRecord = async (
  id: number,
  updates: Partial<SleepRecord>,
) => {
  return axios.put<SleepRecord>(`/metrics/sleep/${id}`, updates);
};
