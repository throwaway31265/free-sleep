import { useDeviceStatus } from '@api/deviceStatus';
import { useSettings } from '@api/settings.ts';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { useTheme } from '@mui/material/styles';
import { useAppStore } from '@state/appStore.tsx';
import { useEffect } from 'react';
import SideControl from '../../components/SideControl.tsx';
import PageContainer from '../PageContainer.tsx';
import AlarmDismissal from './AlarmDismissal.tsx';
import AwayNotification from './AwayNotification.tsx';
import { useControlTempStore } from './controlTempStore.tsx';
import PowerButton from './PowerButton.tsx';
import Slider from './Slider.tsx';
import WaterNotification from './WaterNotification.tsx';

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
  const isOn = sideStatus?.isOn || false;

  useEffect(() => {
    refetch();
  }, [side]);

  return (
    <PageContainer
      sx={{
        maxWidth: '500px',
        [theme.breakpoints.up('md')]: {
          maxWidth: '400px',
        },
      }}
    >
      <SideControl title={'Temperature'} />
      <Slider
        isOn={isOn}
        currentTargetTemp={sideStatus?.targetTemperatureF || 55}
        refetch={refetch}
        currentTemperatureF={sideStatus?.currentTemperatureF || 55}
        displayCelsius={settings?.temperatureFormat === 'celsius' || false}
      />
      {isError ? (
        <Button
          variant="contained"
          onClick={() => refetch()}
          disabled={isUpdating}
        >
          Try again
        </Button>
      ) : (
        <PowerButton isOn={sideStatus?.isOn || false} refetch={refetch} />
      )}

      <AwayNotification settings={settings} />
      <WaterNotification deviceStatus={deviceStatus} />
      <AlarmDismissal deviceStatus={deviceStatus} refetch={refetch} />
      {isUpdating && <CircularProgress />}
    </PageContainer>
  );
}
