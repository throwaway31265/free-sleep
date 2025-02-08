import { useEffect } from 'react';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

import AlarmDismissal from './AlarmDismissal.tsx';
import AwayNotification from './AwayNotification.tsx';
import PageContainer from '../PageContainer.tsx';
import PowerButton from './PowerButton.tsx';
import SideControl from '../../components/SideControl.tsx';
import Slider from './Slider.tsx';
import WaterNotification from './WaterNotification.tsx';
import { useAppStore } from '@state/appStore.tsx';
import { useControlTempStore } from './controlTempStore.tsx';
import { useDeviceStatus } from '@api/deviceStatus';
import { useSettings } from '@api/settings.ts';
import { useTheme } from '@mui/material/styles';


export default function ControlTempPage() {
  const { data: deviceStatusOriginal, isError, refetch } = useDeviceStatus();
  const { setOriginalDeviceStatus, deviceStatus } = useControlTempStore();
  const { data: settings } = useSettings();
  const { isUpdating, side } = useAppStore();
  const theme = useTheme();

  useEffect(() => {
    if (!deviceStatusOriginal) return;
    setOriginalDeviceStatus(deviceStatusOriginal);
  }, [deviceStatusOriginal]);

  const sideStatus = deviceStatus?.[side];

  useEffect(() => {
    refetch();
  }, [side]);

  return (
    <PageContainer
      sx={ {
        maxWidth: '500px',
        [theme.breakpoints.up('md')]: {
          maxWidth: '400px',
        },
      } }>
      <SideControl />
      <Slider
        isOn={ sideStatus?.isOn || false }
        currentTargetTemp={ sideStatus?.targetTemperatureF || 55 }
        refetch={ refetch }
        currentTemperatureF={ sideStatus?.currentTemperatureF || 55 }
        displayCelsius={ settings?.temperatureFormat === 'celsius' || false }
      />
      {
        isError ?
          <Button variant="contained" onClick={ () => refetch() } disabled={ isUpdating }>
            Try again
          </Button>
          :
          <PowerButton
            isOn={ sideStatus?.isOn || false }
            refetch={ refetch }
          />
      }

      <AwayNotification settings={ settings }/>
      <WaterNotification deviceStatus={ deviceStatus }/>
      <AlarmDismissal deviceStatus={ deviceStatus } refetch={ refetch }/>
      { isUpdating && <CircularProgress/> }
    </PageContainer>
  );
}
