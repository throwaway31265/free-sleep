import { useQuery } from '@tanstack/react-query';
import type { DeepPartial } from 'ts-essentials';
import axios from './api';
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
  });

export const postDeviceStatus = (deviceStatus: DeepPartial<DeviceStatus>) => {
  return axios.post('/deviceStatus', deviceStatus);
};
