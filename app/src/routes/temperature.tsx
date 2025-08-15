import { useDeviceStatus } from '@api/deviceStatus';
import { useSettings } from '@api/settings.ts';
import AlarmDismissal from '@components/temperature/AlarmDismissal.tsx';
import AwayNotification from '@components/temperature/AwayNotification.tsx';
import { useControlTempStore } from '@components/temperature/controlTempStore.tsx';
import PowerButton from '@components/temperature/PowerButton.tsx';
import Slider from '@components/temperature/Slider.tsx';
import WaterNotification from '@components/temperature/WaterNotification.tsx';
import { Box } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { useAppStore } from '@state/appStore.tsx';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import PageContainer from '@/components/shared/PageContainer.tsx';
import SideControl from '../components/SideControl.tsx';

function ControlTempPage() {
  const {
    data: deviceStatusOriginal,
    refetch,
    isLoading: isLoadingDevice,
  } = useDeviceStatus();
  const { setOriginalDeviceStatus, deviceStatus } = useControlTempStore();
  const { data: settings, isLoading: isLoadingSettings } = useSettings();
  const { isUpdating, side } = useAppStore();

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
      <PageContainer>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: { xs: '100%', sm: '500px', md: '600px', lg: '650px' },
            margin: '0 auto',
            width: '100%',
          }}
        >
          <SideControl title={'Temperature'} />
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '40vh',
              width: '100%',
            }}
          >
            <CircularProgress sx={{ color: '#fff' }} />
          </Box>
        </Box>
      </PageContainer>
    );
  }

  // Don't render until we have both device status and settings
  if (!deviceStatus || !settings) {
    return null;
  }

  return (
    <PageContainer>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: { xs: '100%', sm: '500px', md: '600px', lg: '650px' },
          margin: '0 auto',
          width: '100%',
          gap: 2,
        }}
      >
        <SideControl title={'Temperature'} />

        <Box
          sx={{
            width: '100%',
            maxWidth: { xs: '320px', sm: '400px', md: '450px' },
            aspectRatio: '1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Slider
            isOn={isOn}
            currentTargetTemp={sideStatus?.targetTemperatureF || 55}
            refetch={refetch}
            currentTemperatureF={sideStatus?.currentTemperatureF || 55}
            displayCelsius={settings?.temperatureFormat === 'celsius' || false}
          />
        </Box>

        <PowerButton isOn={sideStatus?.isOn || false} refetch={refetch} />

        <AwayNotification settings={settings} />
        <WaterNotification deviceStatus={deviceStatus} />
        <AlarmDismissal deviceStatus={deviceStatus} refetch={refetch} />

        {isUpdating && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <CircularProgress />
          </Box>
        )}
      </Box>
    </PageContainer>
  );
}

export const Route = createFileRoute('/temperature')({
  component: ControlTempPage,
});
