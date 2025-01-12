import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { useDeviceStatus } from '@api/deviceStatus';

import AlarmDismissal from './AlarmDismissal.tsx';
import AwayNotification from './AwayNotification.tsx';
import PageContainer from '../PageContainer.tsx';
import PowerButton from './PowerButton.tsx';
import Slider from './Slider.tsx';
import WaterNotification from './WaterNotification.tsx';
import { useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';
import { useEffect } from 'react';


export default function ControlTempPage() {
  const { data: deviceStatus, isError, refetch } = useDeviceStatus();
  const { data: settings } = useSettings();
  const { isUpdating, side } = useAppStore();

  // @ts-ignore
  const sideStatus = deviceStatus?.[side];

  useEffect(() => {
    refetch();
  }, [side]);

  return (
    <PageContainer sx={{ mt: 20 }}>
      <Slider
        isOn={sideStatus?.isOn || false}
        currentTargetTemp={sideStatus?.targetTemperatureF || 55}
        refetch={refetch}
        currentTemperatureF={sideStatus?.currentTemperatureF || 55}
        displayCelsius={settings?.temperatureFormat === 'celsius' || false}
      />

      {
        isError ?
          <Button variant="contained" onClick={() => refetch()} disabled={isUpdating}>
            Try again
          </Button>
          :
          <PowerButton
            isOn={sideStatus?.isOn || false}
            refetch={refetch}
          />
      }
      {isUpdating && <CircularProgress/>}
      <AwayNotification settings={settings}/>
      <WaterNotification deviceStatus={deviceStatus}/>
      <AlarmDismissal deviceStatus={deviceStatus} refetch={refetch}/>
    </PageContainer>
  );
}
