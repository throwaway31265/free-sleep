import { useQuery } from '@tanstack/react-query';
import axios from './api';
import type { Version } from './versionSchema';

export const useVersion = () =>
  useQuery<Version>({
    queryKey: ['useVersion'],
    queryFn: async () => {
      const response = await axios.get<Version>('/version');
      return response.data;
    },
    // Refresh every 5 minutes to catch updates
    refetchInterval: 5 * 60 * 1000,
  });
