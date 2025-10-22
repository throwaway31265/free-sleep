import axios from './api';
import { useQuery } from '@tanstack/react-query';
import { ServerStatus } from './serverStatusSchema.ts';


export const useServerStatus = () => {
  return useQuery<ServerStatus>({
    queryKey: ['useServerStatus'],
    queryFn: async () => {
      const response = await axios.get<ServerStatus>('/serverStatus');
      return response.data;
    },
    refetchInterval: 5_000,
  });
};


