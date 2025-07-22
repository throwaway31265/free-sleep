import { useQuery } from '@tanstack/react-query';
import axios from './api';

/** Type for log list response */
export type LogList = {
  logs: string[];
};

/** Fetch list of logs */
export const useLogList = () =>
  useQuery<LogList>({
    queryKey: ['useLogList'],
    queryFn: async () => {
      const response = await axios.get<LogList>('/logs');
      return response.data;
    },
    refetchInterval: 30_000, // Auto-refresh every 30s
  });
