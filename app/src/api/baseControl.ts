import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from '@tanstack/react-router';
import { z } from 'zod';
import axiosInstance from './api';

// Schemas
const BaseStatusSchema = z.object({
  head: z.number(),
  feet: z.number(),
  isMoving: z.boolean(),
  lastUpdate: z.string(),
  isConfigured: z.boolean().optional(),
});

const BasePositionSchema = z.object({
  head: z.number(),
  feet: z.number(),
  feedRate: z.number().optional(),
});

export type BaseStatus = z.infer<typeof BaseStatusSchema>;
export type BaseStatusUI = Pick<
  BaseStatus,
  'head' | 'feet' | 'isMoving' | 'isConfigured'
>;
export type BasePosition = z.infer<typeof BasePositionSchema>;

// API functions
const getBaseStatus = async (): Promise<BaseStatus> => {
  const response = await axiosInstance.get('/base-control');
  return BaseStatusSchema.parse(response.data);
};

const setBasePosition = async (position: BasePosition) => {
  const response = await axiosInstance.post('/base-control', position);
  return response.data;
};

const setBasePreset = async (preset: 'flat' | 'sleep' | 'relax' | 'read') => {
  const response = await axiosInstance.post('/base-control/preset', {
    preset,
  });
  return response.data;
};

const stopBase = async () => {
  const response = await axiosInstance.post('/base-control/stop');
  return response.data;
};

// React Query hooks
export const useBaseStatus = () => {
  const location = useLocation();
  const isOnElevationRoute = location.pathname === '/base-control';

  return useQuery({
    queryKey: ['baseStatus'],
    queryFn: getBaseStatus,
    refetchInterval: isOnElevationRoute ? 2000 : false, // Only refetch on elevation route
    select: (data) => ({
      // Only include fields that matter for UI state, exclude lastUpdate to prevent unnecessary re-renders
      head: data.head,
      feet: data.feet,
      isMoving: data.isMoving,
      isConfigured: data.isConfigured,
    }),
  });
};

export const useSetBasePosition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setBasePosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baseStatus'] });
    },
  });
};

export const useSetBasePreset = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setBasePreset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baseStatus'] });
    },
  });
};

export const useStopBase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: stopBase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baseStatus'] });
    },
  });
};
