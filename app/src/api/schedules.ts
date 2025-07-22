import type { Schedules } from '@api/schedulesSchema.ts';
import { useQuery } from '@tanstack/react-query';
import type { DeepPartial } from 'ts-essentials';
import axios from './api';

export const useSchedules = () =>
  useQuery<Schedules>({
    queryKey: ['useSchedules'],
    queryFn: async () => {
      const response = await axios.get<Schedules>('/schedules');
      return response.data;
    },
  });

export const postSchedules = (schedules: DeepPartial<Schedules>) => {
  return axios.post('/schedules', schedules);
};
