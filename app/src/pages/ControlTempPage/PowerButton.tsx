import { postDeviceStatus } from '@api/deviceStatus.ts';
import type { DeviceStatus, SideStatus } from '@api/deviceStatusSchema.ts';
import { useSettings } from '@api/settings.ts';
import Button from '@mui/material/Button';
import { useAppStore } from '@state/appStore.tsx';
import type { DeepPartial } from 'ts-essentials';

type PowerButtonProps = {
  isOn: boolean;
  refetch: any;
};

export default function PowerButton({ isOn, refetch }: PowerButtonProps) {
  const { isUpdating, setIsUpdating, side } = useAppStore();
  const { data: settings } = useSettings();
  const isInAwayMode = settings?.[side].awayMode;
  const disabled = isUpdating || isInAwayMode;

  const handleOnClick = () => {
    const sideStatus: Partial<SideStatus> = { isOn: !isOn };
    const deviceStatus: DeepPartial<DeviceStatus> = {};

    deviceStatus[side] = sideStatus;

    setIsUpdating(true);
    postDeviceStatus(deviceStatus)
      .then(() => {
        // Wait 1 second before refreshing the device status
        return new Promise((resolve) => setTimeout(resolve, 1_000));
      })
      .then(() => refetch())
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        setIsUpdating(false);
      });
  };
  if (isInAwayMode) return null;

  return (
    <Button variant="outlined" disabled={disabled} onClick={handleOnClick}>
      {isOn ? 'Turn off' : 'Turn on'}
    </Button>
  );
}
