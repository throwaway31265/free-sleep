import type { SchedulesV2, Side } from '@api/schedulesSchema';
import { useQuery } from '@tanstack/react-query';
import axios from './api';

export const useSchedules = () =>
  useQuery<SchedulesV2>({
    queryKey: ['useSchedules'],
    queryFn: async () => {
      const response = await axios.get<SchedulesV2>('/schedules');
      return response.data;
    },
  });

export const postSchedules = (payload: any) => {
  return axios.post('/schedules', payload);
};

export const deleteSchedule = (side: Side, scheduleId: string) => {
  return axios.delete<SchedulesV2>(`/schedules/${side}/${scheduleId}`);
};
