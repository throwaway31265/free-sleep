import { useDeviceStatus } from '@api/deviceStatus';
import { useSettings } from '@api/settings.ts';
import { Box } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { useTheme } from '@mui/material/styles';
import { useAppStore } from '@state/appStore.tsx';
import { useEffect } from 'react';
import SideControl from '../../components/SideControl.tsx';
import PageContainer from '@/components/shared/PageContainer.tsx';
import AlarmDismissal from './AlarmDismissal.tsx';
import AwayNotification from './AwayNotification.tsx';
import { useControlTempStore } from './controlTempStore.tsx';
import PowerButton from './PowerButton.tsx';
import Slider from './Slider.tsx';
import WaterNotification from './WaterNotification.tsx';

export default function ControlTempPage() {
  const { data: deviceStatusOriginal, refetch, isLoading: isLoadingDevice } = useDeviceStatus();
  const { setOriginalDeviceStatus, deviceStatus } = useControlTempStore();
  const { data: settings, isLoading: isLoadingSettings } = useSettings();
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

  // Show loading state while data is being fetched
  if (isLoadingDevice || isLoadingSettings) {
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
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '50vh'
        }}>
          <CircularProgress sx={{ color: '#fff' }} />
        </Box>
      </PageContainer>
    );
  }

  // Don't render until we have both device status and settings
  if (!deviceStatus || !settings) {
    return null;
  }

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
      <PowerButton isOn={sideStatus?.isOn || false} refetch={refetch} />

      <AwayNotification settings={settings} />
      <WaterNotification deviceStatus={deviceStatus} />
      <AlarmDismissal deviceStatus={deviceStatus} refetch={refetch} />
      {isUpdating && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <CircularProgress />
        </Box>
      )}
    </PageContainer>
  );
}
