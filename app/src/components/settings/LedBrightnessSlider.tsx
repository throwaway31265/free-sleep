import { postDeviceStatus, useDeviceStatus } from '@api/deviceStatus.ts';
import type { DeviceStatus } from '@api/deviceStatusSchema.ts';
import { Box, Slider, Typography } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import _ from 'lodash';
import { useEffect, useState } from 'react';

export default function LedBrightnessSlider() {
  const { isUpdating, setIsUpdating, setError, clearError } = useAppStore();
  const { data: deviceStatus, refetch } = useDeviceStatus();
  const [settingsCopy, setSettingsCopy] = useState<
    undefined | DeviceStatus['settings']
  >();
  useEffect(() => {
    if (!deviceStatus) return;
    const newDeviceStatus = _.cloneDeep(deviceStatus) as DeviceStatus;
    setSettingsCopy(newDeviceStatus.settings);
  }, [deviceStatus]);

  const handleChange = (settings: Partial<DeviceStatus['settings']>) => {
    const newSettings = _.merge({}, settingsCopy, settings);
    setSettingsCopy(newSettings);
  };

  const handleSave = () => {
    setIsUpdating(true);
    clearError(); // Clear any previous errors
    postDeviceStatus({
      settings: settingsCopy,
    })
      .then(() => {
        // Wait 1 second before refreshing the device status
        return new Promise((resolve) => setTimeout(resolve, 1_000));
      })
      .then(() => refetch())
      .catch((error) => {
        console.error(error);

        // Extract meaningful error message for user
        let errorMessage = 'Failed to update LED brightness';

        if (error.response?.status === 400) {
          if (error.response?.data?.details) {
            errorMessage = `Invalid LED setting: ${error.response.data.details}`;
          } else {
            errorMessage = 'Invalid LED brightness setting. Please check the value and try again.';
          }
        } else if (error.response?.status === 500) {
          errorMessage = 'Server error. Please try again in a moment.';
        } else if (error.code === 'NETWORK_ERROR' || !error.response) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }

        setError(errorMessage);
      })
      .finally(() => {
        setIsUpdating(false);
      });
  };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
        LED Brightness Control
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
        Adjust the brightness of status LEDs on your device
      </Typography>
      <Slider
        value={settingsCopy?.ledBrightness || 0}
        onChangeCommitted={handleSave}
        onChange={(_, newValue) => {
          handleChange({
            ledBrightness: newValue as number,
          });
        }}
        min={0}
        max={100}
        step={5}
        marks={[
          { value: 0, label: 'Off' },
          { value: 50, label: '50%' },
          { value: 100, label: '100%' },
        ]}
        disabled={isUpdating}
        sx={{ width: '100%', mt: 1 }}
        valueLabelDisplay="auto"
        valueLabelFormat={(value) => `${value}%`}
      />
    </Box>
  );
}
