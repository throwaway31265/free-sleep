import axios from './api';
import { useQuery } from '@tanstack/react-query';
import { DeepPartial } from 'ts-essentials';
import { Schedules } from '@api/schedulesSchema.ts';

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
