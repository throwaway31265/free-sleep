import axios from './api';
import { isAxiosError } from 'axios';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@state/appStore.tsx';
import type { Side } from './schedulesSchema.ts';
import type {
  AnchorSource,
  AutopilotState,
  Decision,
} from '../../../server/src/autopilot/types.ts';

// WARNING! - Types below mirror GET /api/autopilot/status in server/src/routes/autopilot/autopilot.ts
export type { AnchorSource, AutopilotState, Decision };

export type AutopilotInputs = {
  ambientC: number | null;
  humidity: number | null;
  envAgeS: number | null;
  refC: number | null;
  bedCenC: number | null;
  bedInC: number | null;
  thermPower: number | null;
  thermTargetC: number | null;
};

export type AutopilotSideStatus = {
  enabled: boolean;
  mode: 'active' | 'shadow';
  state: AutopilotState;
  anchorF: number | null;
  anchorSource: AnchorSource | null;
  appliedOffset: number;
  offsetIsVirtual: boolean;
  lastWrittenF: number | null;
  lastWriteAt: number | null;
  holdUntil: number | null;
  pausedUntil: number | null;
  failCount: number;
  writesTonight: number;
  inputs: AutopilotInputs;
  decisions: Decision[];
};

export type AutopilotStatus = Record<Side, AutopilotSideStatus>;

const AUTOPILOT_QUERY_KEY = ['useAutopilot'];

/**
 * Polls autopilot status. Resolves to null when the server has no autopilot
 * route (404, e.g. after a rollback) so callers simply hide their UI.
 */
export const useAutopilotStatus = (enabled = true) => useQuery<AutopilotStatus | null>({
  queryKey: AUTOPILOT_QUERY_KEY,
  queryFn: async () => {
    try {
      const response = await axios.get<AutopilotStatus>('/autopilot/status');
      return response.data;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) return null;
      throw error;
    }
  },
  refetchInterval: 30_000,
  enabled,
});

/**
 * Refreshes autopilot status right away. Call after a manual temperature change, which moves
 * autopilot to HOLD on the server, so the card does not lag behind until the next poll.
 */
export const invalidateAutopilotStatus = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: AUTOPILOT_QUERY_KEY });

export const postAutopilotPause =(side: Side, minutes: number) => {
  return axios.post<AutopilotSideStatus>(`/autopilot/${side}/pause`, { minutes });
};

export const postAutopilotResume = (side: Side) => {
  return axios.post<AutopilotSideStatus>(`/autopilot/${side}/resume`);
};

/**
 * Pause / resume actions wrapped with the global isUpdating flag.
 * Refreshes autopilot and device status afterwards, since both can change.
 */
export const useAutopilotActions = () => {
  const queryClient = useQueryClient();
  const { setIsUpdating } = useAppStore();

  const run = (request: () => Promise<unknown>) => {
    setIsUpdating(true);
    return request()
      .then(() => Promise.all([
        queryClient.invalidateQueries({ queryKey: AUTOPILOT_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['useDeviceStatus'] }),
      ]))
      .catch(error => {
        console.error(error);
      })
      .finally(() => setIsUpdating(false));
  };

  return {
    pause: (side: Side, minutes: number) => run(() => postAutopilotPause(side, minutes)),
    resume: (side: Side) => run(() => postAutopilotResume(side)),
  };
};
