import { useQuery } from '@tanstack/react-query';
import type { DeepPartial } from 'ts-essentials';
import axios from './api';
import type { DeviceStatus } from './deviceStatusSchema';

export const useDeviceStatus = () =>
  useQuery<DeviceStatus>({
    queryKey: ['useDeviceStatus'],
    queryFn: async () => {
      const response = await axios.get<DeviceStatus>('/deviceStatus');
      return response.data;
    },
    refetchInterval: 30_000,
  });

export const postDeviceStatus = (deviceStatus: DeepPartial<DeviceStatus>) => {
  return axios.post('/deviceStatus', deviceStatus);
};
