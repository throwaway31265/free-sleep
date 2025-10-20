import { useQuery } from '@tanstack/react-query';
import type { DeepPartial } from 'ts-essentials';
import axios from './api';
import { isAxiosError } from 'axios';
import type { DeviceStatus } from './deviceStatusSchema';

export const useDeviceStatus = () =>
  useQuery<DeviceStatus>({
    queryKey: ['useDeviceStatus'],
    queryFn: async () => {
      const response = await axios.get<DeviceStatus>('/deviceStatus');

      // Validate that the response is valid JSON
      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Invalid JSON response from device status endpoint');
      }

      return response.data;
    },
    refetchInterval: 30_000,
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors (client errors)
      if (isAxiosError(error) && error.response?.status) {
        const status = error.response.status;
        if (status >= 400 && status < 500) {
          return false;
        }
      }
      // Retry up to 3 times for 5xx errors or network errors
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    // Show stale data while refetching
    staleTime: 5000,
  });

export const postDeviceStatus = (deviceStatus: DeepPartial<DeviceStatus>) => {
  return axios.post('/deviceStatus', deviceStatus);
};

export const postSnoozeAlarm = (side: 'left' | 'right') => {
  return axios.post('/deviceStatus/snooze', { side });
};
