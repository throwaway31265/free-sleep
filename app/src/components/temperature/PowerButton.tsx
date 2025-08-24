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
  const { isUpdating, setIsUpdating, side, setError, clearError } =
    useAppStore();
  const { data: settings } = useSettings();
  const isInAwayMode = settings?.[side]?.awayMode;
  const disabled = isUpdating || isInAwayMode;
  const otherSide = side === 'right' ? 'left' : 'right';
  const linkBoth = settings?.linkBothSides && !settings?.[otherSide]?.awayMode;

  const handleOnClick = () => {
    const sideStatus: Partial<SideStatus> = { isOn: !isOn };
    const deviceStatus: DeepPartial<DeviceStatus> = {};
    deviceStatus[side] = sideStatus;
    if (linkBoth) {
      deviceStatus[otherSide] = { isOn: sideStatus.isOn };
    }

    setIsUpdating(true);
    clearError(); // Clear any previous errors
    postDeviceStatus(deviceStatus)
      .then(() => {
        // Wait 1 second before refreshing the device status
        return new Promise((resolve) => setTimeout(resolve, 1_000));
      })
      .then(() => refetch())
      .catch((error) => {
        console.error(error);

        // Extract meaningful error message for user
        let errorMessage = `Failed to ${isOn ? 'turn off' : 'turn on'} heating`;

        if (error.response?.status === 400) {
          if (error.response?.data?.details) {
            errorMessage = `Invalid power setting: ${error.response.data.details}`;
          } else {
            errorMessage = 'Invalid power setting. Please try again.';
          }
        } else if (error.response?.status === 500) {
          errorMessage = 'Server error. Please try again in a moment.';
        } else if (error.code === 'NETWORK_ERROR' || !error.response) {
          errorMessage =
            'Network error. Please check your connection and try again.';
        }

        setError(errorMessage);
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
