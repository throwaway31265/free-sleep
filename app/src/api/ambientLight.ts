import { useQuery } from '@tanstack/react-query';
import axios from './api';

export interface AmbientLightReading {
  id: number;
  timestamp: number;
  lux: number;
  datetime: string;
}

export interface AmbientLightSummary {
  avgLux: number;
  minLux: number;
  maxLux: number;
  count: number;
}

interface AmbientLightQueryParams {
  startTime?: string; // ISO 8601 format
  endTime?: string; // ISO 8601 format
  limit?: number;
}

export const useAmbientLightReadings = (params?: AmbientLightQueryParams) => {
  return useQuery<AmbientLightReading[]>({
    queryKey: ['useAmbientLightReadings', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();

      if (params?.startTime) queryParams.append('startTime', params.startTime);
      if (params?.endTime) queryParams.append('endTime', params.endTime);
      if (params?.limit) queryParams.append('limit', params.limit.toString());

      const response = await axios.get<AmbientLightReading[]>(
        `/metrics/ambient-light?${queryParams.toString()}`,
      );
      return response.data;
    },
  });
};

export const useAmbientLightSummary = (params?: AmbientLightQueryParams) => {
  return useQuery<AmbientLightSummary>({
    queryKey: ['useAmbientLightSummary', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();

      if (params?.startTime) queryParams.append('startTime', params.startTime);
      if (params?.endTime) queryParams.append('endTime', params.endTime);

      const response = await axios.get<AmbientLightSummary>(
        `/metrics/ambient-light/summary?${queryParams.toString()}`,
      );
      return response.data;
    },
  });
};

export const useLatestAmbientLight = () => {
  return useQuery<AmbientLightReading>({
    queryKey: ['useLatestAmbientLight'],
    queryFn: async () => {
      const response = await axios.get<AmbientLightReading>(
        `/metrics/ambient-light/latest`,
      );
      return response.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds for live updates
  });
};
