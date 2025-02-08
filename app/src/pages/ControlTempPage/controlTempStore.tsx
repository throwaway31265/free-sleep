import _ from 'lodash';
import { create } from 'zustand';
import { DeepPartial } from 'ts-essentials';
import { DeviceStatus } from '@api/deviceStatusSchema.ts';


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
