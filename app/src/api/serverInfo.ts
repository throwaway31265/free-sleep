import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import serverInfo from '../../../server/src/serverInfo.json';
import semver from 'semver';

export type ServerInfo = {
  version: string;
  branch: string;
  updateAvailable: boolean;
}

type LatestVersion = {
  version: string;
  branch: string;
}

export const getLatestVersion = async () => {
  return axios.get<LatestVersion>(
    'https://raw.githubusercontent.com/onemec/free-sleep/main/server/src/serverInfo.json'
  );
};


export const useServerInfo = () => useQuery<ServerInfo>({
  queryKey: ['useServerInfo'],
  queryFn: async () => {
    const response = await getLatestVersion();
    let updateAvailable = semver.gt(response.data.version, serverInfo.version);
    if (import.meta.env.VITE_ENV === 'demo') {
      updateAvailable = true;
    }
    return {
      ...response.data,
      updateAvailable
    };
  },
  staleTime: 60_000,
});

