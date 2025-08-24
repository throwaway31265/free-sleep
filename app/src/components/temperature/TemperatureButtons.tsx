import { postDeviceStatus } from '@api/deviceStatus.ts';
import { MAX_TEMPERATURE_F, MIN_TEMPERATURE_F } from '@api/deviceStatusSchema';
import { useSettings } from '@api/settings.ts';
import { Add, Remove } from '@mui/icons-material';
import { Box, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useAppStore } from '@state/appStore.tsx';
import { useEffect } from 'react';
import { useControlTempStore } from './controlTempStore.tsx';

type TemperatureButtonsProps = {
  refetch: any;
};

export default function TemperatureButtons({
  refetch,
}: TemperatureButtonsProps) {
  const { side, setIsUpdating, isUpdating, setError, clearError } =
    useAppStore();
  const { deviceStatus, setDeviceStatus, originalDeviceStatus } =
    useControlTempStore();
  const { data: settings } = useSettings();
  const isInAwayMode = settings?.[side]?.awayMode;
  const otherSide = side === 'right' ? 'left' : 'right';
  const linkBoth = settings?.linkBothSides && !settings?.[otherSide]?.awayMode;
  const currentTemp = deviceStatus?.[side]?.targetTemperatureF ?? 0;
  const disabled = isUpdating || isInAwayMode;
  const decreaseDisabled = disabled || currentTemp <= MIN_TEMPERATURE_F;
  const increaseDisabled = disabled || currentTemp >= MAX_TEMPERATURE_F;
  const theme = useTheme();
  const borderColor = theme.palette.grey[800];
  const iconColor = theme.palette.grey[500];

  const buttonStyle = {
    borderWidth: '2px',
    borderColor,
    width: 70,
    height: 70,
    borderRadius: '50%',
    minWidth: 0,
    padding: 0,
  };

  useEffect(() => {
    if (deviceStatus === undefined || originalDeviceStatus === undefined)
      return;
    if (
      deviceStatus[side].targetTemperatureF ===
      originalDeviceStatus[side].targetTemperatureF
    ) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsUpdating(true);
      clearError(); // Clear any previous errors
      const payload: any = {
        [side]: {
          targetTemperatureF: deviceStatus[side].targetTemperatureF,
        },
      };
      if (linkBoth) {
        payload[otherSide] = {
          targetTemperatureF: deviceStatus[side].targetTemperatureF,
        };
      }
      await postDeviceStatus(payload)
        .then(() => {
          // Wait 1 second before refreshing the device status
          return new Promise((resolve) => setTimeout(resolve, 1_000));
        })
        .then(() => refetch())
        .catch((error) => {
          console.error(error);

          // Extract meaningful error message for user
          let errorMessage = 'Failed to update temperature';

          if (error.response?.status === 400) {
            if (error.response?.data?.details) {
              errorMessage = `Invalid temperature: ${error.response.data.details}`;
            } else {
              errorMessage =
                'Invalid temperature setting. Please check the value and try again.';
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
    }, 2_000);

    return () => clearTimeout(timer); // Cleanup the timeout
  }, [
    deviceStatus?.[side].targetTemperatureF,
    originalDeviceStatus?.[side].targetTemperatureF,
  ]);

  const handleClick = (change: number) => {
    if (deviceStatus === undefined) return;

    const currentTemp = deviceStatus[side].targetTemperatureF;
    const newTemp = currentTemp + change;

    // Enforce temperature limits
    if (newTemp < MIN_TEMPERATURE_F || newTemp > MAX_TEMPERATURE_F) return;

    setDeviceStatus({
      [side]: {
        targetTemperatureF: newTemp,
      },
    });
  };

  if (isInAwayMode) return null;

  return (
    <Box
      sx={{
        top: '80%',
        position: 'absolute',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '100px',
        width: '100%',
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <Button
        variant="outlined"
        color="primary"
        sx={buttonStyle}
        onClick={() => handleClick(-1)}
        disabled={decreaseDisabled}
      >
        <Remove sx={{ color: iconColor }} />
      </Button>
      <Button
        variant="outlined"
        sx={buttonStyle}
        onClick={() => handleClick(1)}
        disabled={increaseDisabled}
      >
        <Add sx={{ color: iconColor }} />
      </Button>
    </Box>
  );
}
