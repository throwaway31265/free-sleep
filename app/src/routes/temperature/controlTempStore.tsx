import type { DeviceStatus } from '@api/deviceStatusSchema.ts';
import _ from 'lodash';
import type { DeepPartial } from 'ts-essentials';
import { create } from 'zustand';

type ControlTempStore = {
  originalDeviceStatus: DeviceStatus | undefined;
  deviceStatus: DeviceStatus | undefined;
  setDeviceStatus: (newDeviceStatus: DeepPartial<DeviceStatus>) => void;
  setOriginalDeviceStatus: (originalDeviceStatus: DeviceStatus) => void;
};

export const useControlTempStore = create<ControlTempStore>((set, get) => ({
  originalDeviceStatus: undefined,
  deviceStatus: undefined,
  setDeviceStatus: (newDeviceStatus) => {
    const { deviceStatus } = get();
    const updatedDeviceStatus = _.merge(deviceStatus, newDeviceStatus);
    set({ deviceStatus: updatedDeviceStatus });
  },
  setOriginalDeviceStatus: (originalDeviceStatus) => {
    const deviceStatusCopy = _.cloneDeep(originalDeviceStatus);

    set({ deviceStatus: deviceStatusCopy, originalDeviceStatus });
  },
}));
