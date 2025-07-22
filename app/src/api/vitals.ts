import { useQuery } from '@tanstack/react-query';
import type {
  VitalsRecord,
  VitalsSummary,
} from '../../../server/src/db/vitalsRecordSchema';
import axios from './api';
export type { VitalsRecord, VitalsSummary };

interface VitalsRecordQueryParams {
  startTime?: string; // ISO 8601 format (e.g., 2025-01-01T00:00:00Z)
  endTime?: string; // ISO 8601 format (e.g., 2025-01-31T23:59:59Z)
  side?: 'left' | 'right';
}

export const useVitalsRecords = (params?: VitalsRecordQueryParams) => {
  return useQuery<VitalsRecord[]>({
    queryKey: ['useVitalsRecords', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();

      if (params?.startTime) queryParams.append('startTime', params.startTime);
      if (params?.endTime) queryParams.append('endTime', params.endTime);
      if (params?.side) queryParams.append('side', params.side);

      const response = await axios.get<VitalsRecord[]>(
        `/metrics/vitals?${queryParams.toString()}`,
      );
      return response.data;
    },
  });
};

export const useVitalsSummary = (params?: VitalsRecordQueryParams) => {
  return useQuery<VitalsSummary>({
    queryKey: ['useVitalsSummary', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();

      if (params?.startTime) queryParams.append('startTime', params.startTime);
      if (params?.endTime) queryParams.append('endTime', params.endTime);
      if (params?.side) queryParams.append('side', params.side);

      const response = await axios.get<VitalsSummary>(
        `/metrics/vitals/summary?${queryParams.toString()}`,
      );
      return response.data;
    },
  });
};
