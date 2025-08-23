import { useDeviceStatus } from '@api/deviceStatus';
import { useSettings } from '@api/settings.ts';
import LeakAlertNotification from '@components/LeakAlertNotification.tsx';
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
            width: '100%',
            maxWidth: {
              xs: '100%',
              sm: '500px',
              md: '600px',
              lg: '700px',
              xl: '800px',
            },
            mx: 'auto',
            px: { xs: 3, sm: 4, md: 5 },
            py: { xs: 3, sm: 4, md: 6 },
            minHeight: '100vh',
            gap: { xs: 4, sm: 5, md: 6 },
          }}
        >
          {/* Top navigation */}
          <SideControl title={'Temperature'} />

          {/* Loading content - centered in available space */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexGrow: 1,
              width: '100%',
            }}
          >
            <CircularProgress sx={{ color: '#fff' }} size={60} />
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
          width: '100%',
          maxWidth: {
            xs: '100%',
            sm: '500px',
            md: '600px',
            lg: '700px',
            xl: '800px',
          },
          mx: 'auto',
          px: { xs: 3, sm: 4, md: 5 },
          py: { xs: 3, sm: 4, md: 6 },
          minHeight: '100vh',
          gap: { xs: 4, sm: 5, md: 6 },
        }}
      >
        {/* Top navigation */}
        <SideControl title={'Temperature'} />

        {/* Temperature control section */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            flexGrow: 1,
            justifyContent: 'center',
            gap: { xs: 4, sm: 5, md: 6 },
            py: { xs: 2, sm: 3, md: 4 },
          }}
        >
          {/* Temperature slider */}
          <Box
            sx={{
              width: '100%',
              maxWidth: {
                xs: '320px',
                sm: '400px',
                md: '480px',
                lg: '520px',
                xl: '560px',
              },
              aspectRatio: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: { xs: 2, sm: 3 },
            }}
          >
            <Slider
              isOn={isOn}
              currentTargetTemp={sideStatus?.targetTemperatureF || 55}
              refetch={refetch}
              currentTemperatureF={sideStatus?.currentTemperatureF || 55}
              displayCelsius={
                settings?.temperatureFormat === 'celsius' || false
              }
            />
          </Box>

          {/* Power button */}
          <PowerButton isOn={sideStatus?.isOn || false} refetch={refetch} />
        </Box>

        {/* Notifications section */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            gap: { xs: 2, sm: 2.5 },
            pb: { xs: 4, sm: 6 },
          }}
        >
          <AwayNotification settings={settings} />
          <WaterNotification deviceStatus={deviceStatus} />
          <LeakAlertNotification />
          <AlarmDismissal deviceStatus={deviceStatus} refetch={refetch} />

          {isUpdating && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                mt: { xs: 2, sm: 3 },
              }}
            >
              <CircularProgress size={28} />
            </Box>
          )}
        </Box>
      </Box>
    </PageContainer>
  );
}

export const Route = createFileRoute('/temperature')({
  component: ControlTempPage,
});
