import { useEffect, useState } from 'react';
import { postDeviceStatus, useDeviceStatus } from '@api/deviceStatus.ts';
import { DeviceStatus } from '@api/deviceStatusSchema.ts';
import _ from 'lodash';
import { useAppStore } from '@state/appStore.tsx';
import { Box, Slider, Typography } from '@mui/material';

export default function LedBrightnessSlider() {
  const { isUpdating, setIsUpdating } = useAppStore();
  const { data: deviceStatus, refetch } = useDeviceStatus();
  const [settingsCopy, setSettingsCopy] = useState<undefined | DeviceStatus['settings']>();
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
    postDeviceStatus({
      settings: settingsCopy,
    })
      .then(() => {
        // Wait 1 second before refreshing the device status
        return new Promise((resolve) => setTimeout(resolve, 1_000));
      })
      .then(() => refetch())
      .catch(error => {
        console.error(error);
      })
      .finally(() => {
        setIsUpdating(false);
      });
  };
  return (

    <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1 } }>
      <Typography sx={ { mb: -1, textAlign: 'center' } }>
        LED Brightness
      </Typography>
      <Slider
        value={ settingsCopy?.ledBrightness || 0 }
        onChangeCommitted={ handleSave }
        onChange={ (_, newValue) => {
          handleChange({
            ledBrightness: newValue as number,
          });
        } }
        min={ 0 }
        max={ 100 }
        step={ 1 }
        marks={ [
          { value: 0, label: 'Off' },
          { value: 100, label: '100%' },
        ] }
        disabled={ isUpdating }
        sx={ { width: '100%' } }
      />
    </Box>
  );
}
